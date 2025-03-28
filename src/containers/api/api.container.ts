import { Container } from "../../di.js";
import { BrowserContainer } from "../browser/browser.container.js";
import { OpenApiProvider } from "./providers/openapi.provider.js";
import { ServerProvider } from "./providers/server.provider.js";

@Container({
    providers: [ServerProvider, OpenApiProvider],
    containers: [BrowserContainer]
})
export class ApiContainer {}