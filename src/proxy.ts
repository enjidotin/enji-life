import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isPublicRoute = createRouteMatcher(["/signin", "/offline"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const signedIn = await convexAuth.isAuthenticated();
    if (isSignInPage(request) && signedIn) {
      return nextjsMiddlewareRedirect(request, "/dashboard");
    }
    if (!isPublicRoute(request) && !signedIn) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
  {
    // Without maxAge the auth tokens are session cookies, which iOS evicts
    // whenever an installed PWA's process is killed — signing the user out on
    // every launch. Persist for 30 days; each refresh extends the window.
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
