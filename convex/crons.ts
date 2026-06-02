import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily WHOOP sync at 11:00 UTC (morning in the US, afternoon in Europe) so
// the night's sleep and recovery have been scored. Each sync also re-fetches
// a 2-day overlap, so records scored late are still picked up.
crons.cron("sync whoop data", "0 11 * * *", internal.whoop.syncAll, {});

export default crons;
