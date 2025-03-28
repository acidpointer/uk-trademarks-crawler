import { OpenAPIHono } from "@hono/zod-openapi";
import { serve } from "@hono/node-server";

import {
  InitializableProvider,
  Injectable,
  ShutdownableProvider,
} from "../../../di.js";
import { pinoLogger } from "hono-pino";
import logger from "../../../logger.js";
import { OPENAPI_SCHEMA } from "../constants/api.constants.js";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";

@Injectable()
export class ServerProvider
  implements InitializableProvider, ShutdownableProvider
{
  private readonly app = new OpenAPIHono();

  async shutdown() {}

  async onInit() {
    const port = Number(process.env.PORT) || 3000;

    this.app.use(pinoLogger({ pino: logger }));

    this.app.use("*", cors());

    serve({
      fetch: this.app.fetch,
      port,
    });
  }

  get server(): OpenAPIHono {
    return this.app;
  }
}
