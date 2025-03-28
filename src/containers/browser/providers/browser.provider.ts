import { Browser, BrowserContext, chromium, Page } from "patchright";
import {
  InitializableProvider,
  Injectable,
  ShutdownableProvider,
} from "../../../di.js";

@Injectable()
export class BrowserProvider
  implements InitializableProvider, ShutdownableProvider
{
  private initialized = false;
  private browserInstance: BrowserContext | Browser;

  async onInit() {
    this.browserInstance = await this.launch();
  }

  async shutdown() {
    await this.close();
  }

  get instance(): BrowserContext | Browser {
    return this.browserInstance;
  }

  async close() {
    await this.browserInstance.close();
    this.initialized = false;
  }

  async launch(): Promise<BrowserContext | Browser> {
    if (this.initialized && this.browserInstance) {
      return this.browserInstance;
    }

    const useGoogleChrome = !!process.env.USE_GOOGLE_CHROME || false;

    const browser = useGoogleChrome
      ? await chromium.launchPersistentContext("/app/chromeData", {
          channel: "chrome",
          headless: false,
          viewport: null,
        })
      : await chromium.launch({
          channel: "chromium",
          headless: false,
        });

    this.initialized = true;
    return browser;
  }

  async newPage(): Promise<Page> {
    if (this.initialized) {
      return await this.browserInstance.newPage();
    }

    throw new Error("Browser instance not initialized");
  }
}
