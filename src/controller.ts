import { PinoLogger } from "hono-pino";
import PQueue from "p-queue";
import { browser } from "./browser";
import { SearchQuerySchema } from "./schema";
import { performTrademarkSearch } from "./trademarks";
import { TRADEMARKS_URL } from "./constants/trademarks.const";
import { searchQueue } from "./queues";
import { Page } from "patchright";
import {
  Trademark,
  TrademarksLegalStatus,
  TrademarksSearchType,
  TrademarksWordSearchMatchType,
} from "./types/trademarks.types";
import logger from "./logger";

async function queuedTrademarkSearch(
  page: Page,
  searchWords: Array<string>,
  fromDate: Date,
  toDate: Date,
  wordMatchType: TrademarksWordSearchMatchType = "ANYWORDS",
  searchType: TrademarksSearchType = "EXACT",
  legalStatus: TrademarksLegalStatus = "ALLLEGALSTATUSES",
  resultsPerPage: number = 10,
  classIds: string[] = []
): Promise<Array<Trademark> | void> {
  return searchQueue.add(async () => {
    logger.info(
      `Starting search for "${searchWords.join(", ")}" (Queue size: ${
        searchQueue.size
      })`
    );
    try {
      const results = await performTrademarkSearch(
        page,
        searchWords,
        fromDate,
        toDate,
        wordMatchType,
        searchType,
        legalStatus,
        resultsPerPage,
        classIds
      );

      logger.info(
        `Completed search for "${searchWords.join(", ")}" (Queue pending: ${
          searchQueue.pending
        })`
      );
      return results;
    } catch (error) {
      logger.error(`Search error for "${searchWords.join(", ")}":`, error);
      throw error;
    }
  });
}

searchQueue.on("active", () => {
  logger.info(
    `(Queue) Working on item. Size: ${searchQueue.size}, Pending: ${searchQueue.pending}`
  );
});

searchQueue.on("add", () => {
  logger.info(`(Queue) Task added. Queue size: ${searchQueue.size}`);
});

searchQueue.on("next", () => {
  logger.info(`(Queue) Task completed. Remaining: ${searchQueue.size}`);
});

export const trademarkController = async (c) => {
  try {
    const { logger } = c.var as { logger: PinoLogger };

    const query = c.req.query();

    logger.debug(`Query is: ${JSON.stringify(query, null, 2)}`);

    const validationResult = SearchQuerySchema.safeParse(query);

    if (!validationResult.success) {
      return c.json(
        {
          error: "Invalid parameters",
          details: validationResult.error.format(),
        },
        400
      );
    }

    const {
      words,
      type,
      wordMatchType,
      status,
      perPage,
      classes,
      fromDate,
      toDate,
    } = validationResult.data;

    const page = await browser.newPage();

    await page.goto(TRADEMARKS_URL);

    /*
    const results = await performTrademarkSearch(
      page,
      words,
      fromDate,
      toDate,
      wordMatchType,
      type,
      status,
      perPage,
      classes
    );
    */

    const results = await queuedTrademarkSearch(
      page,
      words,
      fromDate,
      toDate,
      wordMatchType,
      type,
      status,
      perPage,
      classes
    );

    await page.close();

    return c.json({
      results,
      meta: {
        count: Array.isArray(results) ? results.length : 0,
        searchWords: words,
        searchType: type,
        legalStatus: status,
        resultsPerPage: perPage,
        classIds: classes,
        fromDate,
        toDate,
      },
    });
  } catch (err) {
    return c.json(
      {
        error: "Internal server error",
        message: err.message,
      },
      500
    );
  }
};
