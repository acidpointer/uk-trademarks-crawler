import { chromium } from "patchright";

const USE_GOOGLE_CHROME = !!process.env.USE_GOOGLE_CHROME || false;


export const browser = USE_GOOGLE_CHROME ? await chromium.launchPersistentContext("/app/chromeData", {
    channel: "chrome",
    headless: false,
    viewport: null,
}) : await chromium.launch({
  channel: "chromium",
  headless: false,
});
