import { detectSlaBreaches } from "../services/slaService.js";

const scanIntervalMs = 60_000;

export function startSlaScanner() {
  const timer = setInterval(() => {
    void detectSlaBreaches().catch((error) => {
      console.error("SLA scanner failed", error);
    });
  }, scanIntervalMs);

  timer.unref();

  return timer;
}
