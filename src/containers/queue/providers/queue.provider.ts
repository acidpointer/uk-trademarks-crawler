import PQueue from "p-queue";
import {
  InitializableProvider,
  Injectable,
  ShutdownableProvider,
} from "../../../di.js";
import logger from "../../../logger.js";

@Injectable()
export class QueueProvider
  implements InitializableProvider, ShutdownableProvider
{
  private queue: PQueue;

  async onInit() {
    const concurrency = Number(process.env.QUEUE_CONCURRENCY) || 5;

    this.queue = new PQueue({
      concurrency,
      intervalCap: 10,
      interval: 10000,
      timeout: 30000,
      autoStart: true,
    });

    this.queue.on("active", () => {
      logger.info(
        `(Queue) Working on item. Size: ${this.queue.size}, Pending: ${this.queue.pending}`
      );
    });

    this.queue.on("add", () => {
      logger.info(`(Queue) Task added. Queue size: ${this.queue.size}`);
    });

    this.queue.on("next", () => {
      logger.info(`(Queue) Task completed. Remaining: ${this.queue.size}`);
    });
  }

  get instance(): PQueue {
    return this.queue;
  }

  async shutdown() {
    this.queue.pause();

    if (this.queue.pending > 0) {
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(resolve, 10000)
      );
      const queueDrainPromise = this.queue.onIdle();

      await Promise.race([queueDrainPromise, timeoutPromise]);
    }
  }
}
