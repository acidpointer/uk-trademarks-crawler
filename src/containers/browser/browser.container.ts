import { Container } from "../../di.js";
import { BrowserProvider } from "./providers/browser.provider.js";

@Container({
    providers: [BrowserProvider]
})
export class BrowserContainer {}