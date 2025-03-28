import { swaggerUI } from "@hono/swagger-ui";
import { InitializableProvider, Injectable } from "../../../di.js";
import { OPENAPI_SCHEMA } from "../constants/api.constants.js";
import { ServerProvider } from "./server.provider.js";

@Injectable()
export class OpenApiProvider implements InitializableProvider {
  constructor(private deps: { serverProvider: ServerProvider }) {}

  async onInit() {
    this.deps.serverProvider.server.get("/doc", (c) => {
      return c.json(this.deps.serverProvider.server.getOpenAPIDocument(OPENAPI_SCHEMA));
    });

    this.deps.serverProvider.server.get("/swagger", swaggerUI({ url: "/doc" }));
  }
}
