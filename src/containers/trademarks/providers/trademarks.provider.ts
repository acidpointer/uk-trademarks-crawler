import { Page } from "patchright";
import { Injectable } from "../../../di.js";
import {
  Trademark,
  TrademarkClass,
  TrademarkClassID,
  TrademarksLegalStatus,
  TrademarksSearchType,
  TrademarksWordSearchMatchType,
} from "../types/trademarks.types.js";
import {
  DEFAULT_TRADEMARK_CLASSES,
  TRADEMARKS_URL,
} from "../constants/trademarks.constants.js";
import logger from "../../../logger.js";
import { QueueProvider } from "../../queue/providers/queue.provider.js";

const normalizeStringifiedNumber = (data: string) => {
  data = data.trim().toLowerCase();

  if (Number(data) <= 0 || isNaN(Number(data))) {
    return "01";
  }

  if (data.length == 1) {
    return `0${data}`;
  }

  return data;
};

@Injectable()
export class TrademarksProvider {
  constructor(private deps: { queueProvider: QueueProvider }) {}

  async setSearchType(page: Page, value: TrademarksSearchType): Promise<void> {
    await page.selectOption('select[name="wordSearchType"]', value);
  }

  async setSearchWords(page: Page, words: Array<string>): Promise<void> {
    await page.fill('input[name="wordSearchPhrase"]', words.join(" "));
  }

  async setFiledBetweenDates(
    page: Page,
    fromDate: Date,
    toDate: Date
  ): Promise<void> {
    const fromDay = normalizeStringifiedNumber(fromDate.getDay().toString());
    const fromMonth = normalizeStringifiedNumber(
      fromDate.getMonth().toString()
    );
    const fromYear = normalizeStringifiedNumber(
      fromDate.getFullYear().toString()
    );

    const toDay = normalizeStringifiedNumber(toDate.getDay().toString());
    const toMonth = normalizeStringifiedNumber(toDate.getMonth().toString());
    const toYear = normalizeStringifiedNumber(toDate.getFullYear().toString());

    await page.fill('input[name="filedFrom.day"]', fromDay);
    await page.fill('input[name="filedFrom.month"]', fromMonth);
    await page.fill('input[name="filedFrom"]', fromYear);

    await page.fill('input[name="filedTo.day"]', toDay);
    await page.fill('input[name="filedTo.month"]', toMonth);
    await page.fill('input[name="filedTo"]', toYear);
  }

  async setLegalStatus(page: Page, status: string): Promise<void> {
    await page.selectOption('select[name="legalStatus"]', status);
  }

  async setResultsPerPage(page: Page, count: number): Promise<void> {
    await page.selectOption('select[name="pageSize"]', count.toString());
  }

  async submitSearchForm(page: Page): Promise<void> {
    await page.click('button#button[type="submit"]');

    try {
      await Promise.race([
        page.waitForURL(/page\/Results/, { timeout: 30000 }),
        page.locator(".error-summary, .validation-summary-errors").waitFor({
          state: "visible",
          timeout: 30000,
        }),
      ]);

      const errorLocator = page.locator(
        ".error-summary, .validation-summary-errors"
      );
      const errorCount = await errorLocator.count();

      if (errorCount > 0) {
        const errorText = await errorLocator.textContent();
        throw new Error(`Search criteria error: ${errorText?.trim()}`);
      }

      const noResultsLocator = page.locator(
        'text="No trade marks matching your search criteria were found"'
      );
      const noResultsCount = await noResultsLocator.count();

      if (noResultsCount > 0) {
        throw new Error(
          "No trade marks matching your search criteria were found"
        );
      }

      await page.locator(".search-results").first().waitFor({
        state: "visible",
        timeout: 5000,
      });
    } catch (error) {
      if (
        error.message.includes("Search criteria error:") ||
        error.message.includes("No trade marks matching")
      ) {
        throw error;
      }

      const noResultsLocator = page.locator(
        'text="No trade marks matching your search criteria were found"'
      );
      const noResultsCount = await noResultsLocator.count();

      if (noResultsCount > 0) {
        throw new Error(
          "No trade marks matching your search criteria were found"
        );
      }

      throw new Error(`Form submission failed: ${error.message}`);
    }
  }

  async extractTrademarkResults(page: Page): Promise<Array<Trademark>> {
    const results: Array<Trademark> = [];

    const resultContainers = await page.locator(".search-results").all();

    const startIndex = resultContainers.length > 1 ? 1 : 0;

    for (let i = startIndex; i < resultContainers.length; i++) {
      const container = resultContainers[i];

      const idElement = container.locator(".bold-medium a").first();
      const id = (await idElement.getAttribute("id")) || "";

      const statusField = container
        .locator('.results-field:has-text("Status:")')
        .first();
      const status = (await statusField.locator(".data").textContent()) || "";

      const markTextField = container
        .locator('.results-field:has-text("Mark text:")')
        .first();
      const markText =
        (await markTextField.locator(".data").textContent()) || "";

      const fileDateField = container
        .locator('.results-field:has-text("File date:")')
        .first();
      const fileDate =
        (await fileDateField.locator(".data").textContent()) || "";

      const classesField = container
        .locator('.results-field:has-text("Classes:")')
        .first();
      const classes = (await classesField.locator(".data").textContent()) || "";

      if (id) {
        results.push({
          id,
          status,
          markText,
          fileDate,
          classes,
        });
      }
    }

    return results;
  }

  async hasNextPage(page: Page): Promise<boolean> {
    const nextPageButton = page.locator(".pagination-alt2 a.fa-angle-right");
    return (await nextPageButton.count()) > 0;
  }

  async goToNextPage(page: Page): Promise<void> {
    if (await this.hasNextPage(page)) {
      await Promise.all([
        page.waitForURL(/page\/Results/, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }),
        page.locator(".pagination-alt2 a.fa-angle-right").first().click(),
      ]);

      await page.locator(".search-results").first().waitFor({
        state: "visible",
        timeout: 5000,
      });
    } else {
      throw new Error("No next page available");
    }
  }

  async getTotalPages(page: Page): Promise<number> {
    const paginationLocator = page.locator(".pagination-alt2 li").first();
    const paginationText = (await paginationLocator.textContent()) || "";
    const match = paginationText.match(/Page \d+ of (\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  async getAllTrademarkResults(page: Page): Promise<Array<Trademark>> {
    let allResults: Array<Trademark> = [];

    const results = await this.extractTrademarkResults(page);
    allResults = [...results];

    if (await this.hasNextPage(page)) {
      const totalPages = await this.getTotalPages(page);

      for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
        await this.goToNextPage(page);
        const pageResults = await this.extractTrademarkResults(page);
        allResults = [...allResults, ...pageResults];
      }
    }

    return allResults;
  }

  async setWordSearchMatchType(
    page: Page,
    option: TrademarksWordSearchMatchType
  ): Promise<void> {
    const selector = `input[name="wordSearchMatchType"][value="${option}"]`;

    const radioButton = await page.$(selector);
    if (!radioButton) {
      throw new Error(`Radio button for option "${option}" not found`);
    }

    await page.click(selector);

    const isChecked = await page.$eval(
      selector,
      (input) => (input as HTMLInputElement).checked
    );
    if (!isChecked) {
      throw new Error(`Failed to set radio button for "${option}"`);
    }
  }

  async fetchAvailableClasses(page: Page): Promise<TrademarkClass[]> {
    try {
      return await page.$$eval("select.chosen-select option", (options) => {
        return options
          .filter((option) => (option as HTMLOptionElement).value)
          .map((option) => ({
            id: (option as HTMLOptionElement).value,
            name: option.textContent?.trim() || "",
          }));
      });
    } catch (err) {
      logger.error(
        `(fetchAvailableClasses) Cant fetch Trademarks Classes: ${err?.message} --\n${err?.stack}`
      );
      return [];
    }
  }

  async getTrademarkClasses(page: Page): Promise<Array<TrademarkClass>> {
    const pageClasses = await this.fetchAvailableClasses(page);
    return pageClasses.length > 0 ? pageClasses : DEFAULT_TRADEMARK_CLASSES;
  }

  async selectTrademarkClasses(page: Page, classIds: string[]): Promise<void> {
    if (!classIds || classIds.length === 0) return;

    await page.click("#clearAll");

    const actuallySelected = await page.evaluate((ids) => {
      const select = document.querySelector(
        "select.chosen-select"
      ) as HTMLSelectElement;
      if (!select) return [];

      const selectedIds = [];

      for (const option of Array.from(select.options)) {
        option.selected = false;
      }

      for (const id of ids) {
        for (const option of Array.from(select.options)) {
          if (option.value === id) {
            option.selected = true;
            selectedIds.push(id);
            break;
          }
        }
      }

      select.dispatchEvent(new Event("change"));

      // @ts-ignore - jQuery is available on the page
      if (typeof $ !== "undefined") {
        // @ts-ignore
        $(".chosen-select").trigger("chosen:updated");
      }

      return selectedIds;
    }, classIds);

    if (actuallySelected.length > 0) {
      await page.waitForSelector(".chosen-choices .search-choice", {
        state: "visible",
        timeout: 3000,
      });
    }
  }

  async performTrademarkSearch(
    page: Page,
    searchWords: Array<string>,
    fromDate: Date,
    toDate: Date,
    wordMatchType: TrademarksWordSearchMatchType = "ANYWORDS",
    searchType: TrademarksSearchType = "EXACT",
    legalStatus: TrademarksLegalStatus = "ALLLEGALSTATUSES",
    resultsPerPage: number = 10,
    classIds: Array<TrademarkClassID> = []
  ): Promise<Array<Trademark>> {
    if (!page.url().includes("ipo-tmtext")) {
      await page.goto(TRADEMARKS_URL);
    }

    await this.setWordSearchMatchType(page, wordMatchType);
    await this.setSearchType(page, searchType);
    await this.setSearchWords(page, searchWords);

    await this.selectTrademarkClasses(page, classIds);

    await this.setFiledBetweenDates(page, fromDate, toDate);
    await this.setLegalStatus(page, legalStatus);
    await this.setResultsPerPage(page, resultsPerPage);

    await this.submitSearchForm(page);

    const trademarks: Array<Trademark> = await this.getAllTrademarkResults(
      page
    );

    return trademarks;
  }

  async queuedTrademarkSearch(
    page: Page,
    searchWords: Array<string>,
    fromDate: Date,
    toDate: Date,
    wordMatchType: TrademarksWordSearchMatchType = "ANYWORDS",
    searchType: TrademarksSearchType = "EXACT",
    legalStatus: TrademarksLegalStatus = "ALLLEGALSTATUSES",
    resultsPerPage: number = 10,
    classIds: string[] = []
  ): Promise<Array<Trademark> | void> {
    return this.deps.queueProvider.instance.add(async () => {
      logger.info(
        `Starting search for "${searchWords.join(", ")}" (Queue size: ${
          this.deps.queueProvider.instance.size
        })`
      );
      try {
        const results = await this.performTrademarkSearch(
          page,
          searchWords,
          fromDate,
          toDate,
          wordMatchType,
          searchType,
          legalStatus,
          resultsPerPage,
          classIds
        );

        logger.info(
          `Completed search for "${searchWords.join(", ")}" (Queue pending: ${
            this.deps.queueProvider.instance.pending
          })`
        );
        return results;
      } catch (error) {
        logger.error(`Search error for "${searchWords.join(", ")}":`, error);
        throw error;
      }
    });
  }
}
