import PQueue from "p-queue";

const CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY) || 5;

export const searchQueue = new PQueue({
  concurrency: CONCURRENCY,
  intervalCap: 10,
  interval: 10000,
  timeout: 30000,
  autoStart: true,
});
