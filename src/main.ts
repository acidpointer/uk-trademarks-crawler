import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { browser } from "./browser";
import { trademarkClasses, trademarkSearch } from "./controller";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { PinoLogger, pinoLogger } from "hono-pino";

import {
  ErrorResponseSchema,
  SearchQuerySchema,
  SearchResponseSchema,
  TrademarkClassesSchema,
} from "./schema";
import { searchQueue } from "./queues";
import logger from "./logger";

const port = Number(process.env.PORT) || 3000;
const app = new OpenAPIHono();

app.use(pinoLogger({ pino: logger }));

app.use("*", async (c, next) => {
  const requestStartTime = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  const { logger } = c.var as { logger: PinoLogger };

  await next();

  const requestEndTime = performance.now();
  const duration = Math.round(requestEndTime - requestStartTime);

  logger.debug(`(${method}) '${path}' -- ${duration}ms`);
});

app.openapi(
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
  trademarkSearch
);

app.openapi(
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
  trademarkClasses
);

const openAPISchema = {
  openapi: "3.0.0",
  info: {
    title: "Trademark Search API",
    version: "1.0.0",
    description: "API for searching trademarks",
  },
  servers: [
    {
      url: "/",
      description: "Local server",
    },
  ],
};

app.get("/doc", (c) => {
  return c.json(app.getOpenAPIDocument(openAPISchema));
});

app.use("*", cors());
app.get("/swagger", swaggerUI({ url: "/doc" }));

const gracefullShutdown = async () => {
  try {
    await browser.close();
    searchQueue.pause();

    if (searchQueue.pending > 0) {
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(resolve, 10000)
      );
      const queueDrainPromise = searchQueue.onIdle();

      await Promise.race([queueDrainPromise, timeoutPromise]);
    }

    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
};

const signals = ["SIGINT", "SIGUSR", "SIGUSR2"];

signals.forEach((signal: string) => {
  process.on(signal, gracefullShutdown);
});

serve({
  fetch: app.fetch,
  port,
});
