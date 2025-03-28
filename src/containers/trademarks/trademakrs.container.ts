import { Container } from "../../di.js";
import { ApiContainer } from "../api/api.container.js";
import { BrowserContainer } from "../browser/browser.container.js";
import { QueueContainer } from "../queue/queue.container.js";
import { TrademarksController } from "./controllers/trademarks.controller.js";
import { TrademarksProvider } from "./providers/trademarks.provider.js";

@Container({
    providers: [TrademarksProvider, TrademarksController],
    containers: [BrowserContainer, QueueContainer, ApiContainer]
})
export class TrademarksContainer {}