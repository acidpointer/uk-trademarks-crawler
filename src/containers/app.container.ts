import { Container } from "../di.js";
import { ApiContainer } from "./api/api.container.js";
import { TrademarksContainer } from "./trademarks/trademakrs.container.js";

@Container({
    containers: [TrademarksContainer]
})
export class AppContainer {}