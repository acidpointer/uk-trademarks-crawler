import { PinoLogger } from "hono-pino";
import { InitializableProvider, Injectable } from "../../../di.js";
import {
  SearchQuerySchema,
  SearchResponseSchema,
  TrademarkClassesSchema,
} from "../schema/trademarks.schema.js";
import { BrowserProvider } from "../../browser/providers/browser.provider.js";
import { TRADEMARKS_URL } from "../constants/trademarks.constants.js";
import { TrademarksProvider } from "../providers/trademarks.provider.js";
import { createRoute } from "@hono/zod-openapi";
import { ErrorResponseSchema } from "../../api/schema/errors.schema.js";
import { ServerProvider } from "../../api/providers/server.provider.js";

@Injectable()
export class TrademarksController implements InitializableProvider {
  constructor(
    private deps: {
      trademarksProvider: TrademarksProvider;
      serverProvider: ServerProvider;
      browserProvider: BrowserProvider;
    }
  ) {}

  async onInit() {
    this.deps.serverProvider.server.openapi(
      createRoute({
        method: "get",
        path: "/search",
        request: {
          query: SearchQuerySchema,
        },
        summary: "Search for trademarks",
        description: "Search for trademarks based on various criteria",
        responses: {
          200: {
            description: "Successful search results",
            content: {
              "application/json": {
                schema: SearchResponseSchema,
              },
            },
          },
          400: {
            description: "Bad Request - Invalid parameters",
            content: {
              "application/json": {
                schema: ErrorResponseSchema,
              },
            },
          },
          500: {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      }),
      (c) => this.trademarkSearch(c)
    );

    this.deps.serverProvider.server.openapi(
      createRoute({
        method: "get",
        path: "/classes",
        summary: "Get available trademarks classes",
        description: "Get available trademarks classes",
        responses: {
          200: {
            description: "Successfully fetched classes",
            content: {
              "application/json": {
                schema: TrademarkClassesSchema,
              },
            },
          },
          400: {
            description: "Bad Request - Invalid parameters",
            content: {
              "application/json": {
                schema: ErrorResponseSchema,
              },
            },
          },
          500: {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      }),
      (c) => this.trademarkClasses(c),
    );
  }

  async trademarkSearch(c) {
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

      const page = await this.deps.browserProvider.newPage();

      await page.goto(TRADEMARKS_URL);

      try {
        const results =
          await this.deps.trademarksProvider.queuedTrademarkSearch(
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
        await page.close();

        throw err;
      }
    } catch (err) {
      return c.json(
        {
          error: "Internal server error",
          message: err.message,
        },
        500
      );
    }
  }

  async trademarkClasses(c) {
    try {
      const page = await this.deps.browserProvider.newPage();

      await page.goto(TRADEMARKS_URL);

      try {
        const results = await this.deps.trademarksProvider.getTrademarkClasses(
          page
        );
        await page.close();

        return c.json({
          results,
          meta: {
            count: Array.isArray(results) ? results.length : 0,
          },
        });
      } catch (err) {
        await page.close();

        throw err;
      }
    } catch (err) {
      return c.json(
        {
          error: "Internal server error",
          message: err.message,
        },
        500
      );
    }
  }
}
