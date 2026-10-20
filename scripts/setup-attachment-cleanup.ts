import "dotenv/config";
import { Client } from "@upstash/qstash";
import { ATTACHMENT_CONFIG } from "../constants/attachments";

async function main() {
  if (!process.env.QSTASH_TOKEN || !process.env.APP_URL)
    throw new Error(
      "Set QSTASH_TOKEN and APP_URL before creating the schedule.",
    );
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const destination = `${process.env.APP_URL.replace(/\/$/, "")}/api/attachments/cleanup`;
  const schedules = await client.schedules.list();
  const existing = schedules.find(
    (schedule) => schedule.destination === destination,
  );
  // A stable ID updates our existing schedule instead of creating duplicates.
  const result = await client.schedules.create({
    destination,
    cron: ATTACHMENT_CONFIG.cleanupCron,
    scheduleId: existing?.scheduleId ?? "qchat-attachment-cleanup",
    retries: 3,
    timeout: 50,
    body: "{}",
    headers: { "Content-Type": "application/json" },
  });
  console.info(`Hourly attachment cleanup ready: ${result.scheduleId}`);
}
main().catch(() => {
  console.error(
    "Could not configure cleanup. Check APP_URL, QSTASH_TOKEN, and QStash connectivity.",
  );
  process.exitCode = 1;
});
