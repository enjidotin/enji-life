import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily WHOOP sync at 04:30 UTC = 10:00 AM IST, after the night's sleep and
// recovery have been scored. Each sync also re-fetches a 2-day overlap, so
// records scored late are still picked up.
crons.cron("sync whoop data", "30 4 * * *", internal.whoop.syncAll, {});

export default crons;
