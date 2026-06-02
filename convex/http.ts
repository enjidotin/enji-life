import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { exchangeWhoopCode, fetchWhoopProfile } from "./whoop";

const http = httpRouter();

auth.addHttpRoutes(http);

// OAuth redirect target registered with WHOOP:
//   <CONVEX_SITE_URL>/whoop/callback
http.route({
  path: "/whoop/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const fail = (reason: string) =>
      Response.redirect(
        `${siteUrl}/whoop?error=${encodeURIComponent(reason)}`,
        302,
      );

    const error = url.searchParams.get("error");
    if (error) return fail(error);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return fail("Missing code or state");

    // CSRF check: the state must match one we created for a signed-in user.
    const userId = await ctx.runMutation(internal.whoop.consumeOauthState, {
      state,
    });
    if (!userId) return fail("Invalid or expired state. Try connecting again.");

    try {
      const token = await exchangeWhoopCode(code);
      const profile = await fetchWhoopProfile(token.access_token);
      const accountId = await ctx.runMutation(internal.whoop.saveAccount, {
        userId,
        whoopUserId: profile?.user_id,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1000,
        scopes: token.scope,
      });
      // Pull the first month of history in the background.
      await ctx.scheduler.runAfter(0, internal.whoop.syncAccount, {
        accountId,
      });
      return Response.redirect(`${siteUrl}/whoop?connected=1`, 302);
    } catch (err) {
      return fail(String(err).slice(0, 150));
    }
  }),
});

export default http;
