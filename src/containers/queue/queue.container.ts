import { Container } from "../../di.js";
import { QueueProvider } from "./providers/queue.provider.js";

@Container({
    providers: [QueueProvider]
})
export class QueueContainer {}