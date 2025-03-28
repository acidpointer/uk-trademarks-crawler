import { AppContainer } from "./containers/app.container.js";
import { registerContainer } from "./di.js";

await registerContainer(AppContainer);
