import { Page } from "patchright";
import {
  DEFAULT_TRADEMARK_CLASSES,
  TRADEMARKS_URL,
} from "../constants/trademarks.const";
import {
  Trademark,
  TrademarkClass,
  TrademarkClassID,
  TrademarksLegalStatus,
  TrademarksSearchType,
  TrademarksWordSearchMatchType,
} from "../types/trademarks.types";
import logger from "../logger";

async function setSearchType(
  page: Page,
  value: TrademarksSearchType
): Promise<void> {
  await page.selectOption('select[name="wordSearchType"]', value);
}

async function setSearchWords(page: Page, words: Array<string>): Promise<void> {
  await page.fill('input[name="wordSearchPhrase"]', words.join(" "));
}

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

async function setFiledBetweenDates(
  page: Page,
  fromDate: Date,
  toDate: Date
): Promise<void> {
  const fromDay = normalizeStringifiedNumber(fromDate.getDay().toString());
  const fromMonth = normalizeStringifiedNumber(fromDate.getMonth().toString());
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

async function setLegalStatus(page: Page, status: string): Promise<void> {
  await page.selectOption('select[name="legalStatus"]', status);
}

async function setResultsPerPage(page: Page, count: number): Promise<void> {
  await page.selectOption('select[name="pageSize"]', count.toString());
}

async function submitSearchForm(page: Page): Promise<void> {
  await page.click('button#button[type="submit"]');
  
  try {
    await Promise.race([
      page.waitForURL(/page\/Results/, { timeout: 30000 }),
      page.waitForSelector('.error-summary, .validation-summary-errors', { 
        state: 'visible', 
        timeout: 30000 
      })
    ]);
    
    const errorVisible = await page.isVisible('.error-summary, .validation-summary-errors');
    
    if (errorVisible) {
      const errorText = await page.textContent('.error-summary, .validation-summary-errors');
      throw new Error(`Search criteria error: ${errorText?.trim()}`);
    }
    
    const noResultsVisible = await page.isVisible('text="No trade marks matching your search criteria were found"');
    
    if (noResultsVisible) {
      throw new Error('No trade marks matching your search criteria were found');
    }
    
    await page.waitForSelector(".search-results", {
      state: "visible",
      timeout: 5000,
    });
  } catch (error) {
    if (error.message.includes('Search criteria error:') || 
        error.message.includes('No trade marks matching')) {
      throw error;
    }
    
    throw new Error(`Form submission failed: ${error.message}`);
  }
}

async function extractTrademarkResults(page: Page): Promise<Array<Trademark>> {
  const results: Array<Trademark> = [];

  const resultContainers = await page.$$(".search-results");

  for (let i = 1; i < resultContainers.length; i++) {
    const container = resultContainers[i];

    const idElement = await container.$(".bold-medium a");
    const id = idElement ? (await idElement.getAttribute("id")) || "" : "";

    const statusField = await container.$('.results-field:has-text("Status:")');
    const status = statusField
      ? await statusField.$eval(".data", (el) => el.textContent?.trim() || "")
      : "";

    const markTextField = await container.$(
      '.results-field:has-text("Mark text:")'
    );
    const markText = markTextField
      ? await markTextField.$eval(".data", (el) => el.textContent?.trim() || "")
      : "";

    const fileDateField = await container.$(
      '.results-field:has-text("File date:")'
    );

    const fileDate = fileDateField
      ? await fileDateField.$eval(".data", (el) => el.textContent?.trim() || "")
      : "";

    const classesField = await container.$(
      '.results-field:has-text("Classes:")'
    );

    const classes = classesField
      ? await classesField.$eval(".data", (el) => el.textContent?.trim() || "")
      : "";

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

async function hasNextPage(page: Page): Promise<boolean> {
  return await page.$$eval(
    ".pagination-alt2 a.fa-angle-right",
    (elements) => elements.length > 0
  );
}

async function goToNextPage(page: Page): Promise<void> {
  if (await hasNextPage(page)) {
    await Promise.all([
      page.waitForURL(/page\/Results/, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }),
      page.click(".pagination-alt2 a.fa-angle-right"),
    ]);

    await page.waitForSelector(".search-results", {
      state: "visible",
      timeout: 5000,
    });
  } else {
    throw new Error("No next page available");
  }
}

async function getTotalPages(page: Page): Promise<number> {
  const paginationText = await page.$eval(
    ".pagination-alt2 li:nth-child(1)",
    (el) => el.textContent || ""
  );
  const match = paginationText.match(/Page \d+ of (\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

async function getAllTrademarkResults(page: Page): Promise<Array<Trademark>> {
  let allResults: Array<Trademark> = [];

  const results = await extractTrademarkResults(page);
  allResults = [...allResults, ...results];

  const totalPages = await getTotalPages(page);

  for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
    await goToNextPage(page);
    const pageResults = await extractTrademarkResults(page);
    allResults = [...allResults, ...pageResults];
  }

  return allResults;
}

async function setWordSearchMatchType(
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

async function fetchAvailableClasses(page: Page): Promise<TrademarkClass[]> {
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

export async function getTrademarkClasses(
  page: Page
): Promise<Array<TrademarkClass>> {
  const pageClasses = await fetchAvailableClasses(page);
  return pageClasses.length > 0 ? pageClasses : DEFAULT_TRADEMARK_CLASSES;
}

async function selectTrademarkClasses(page: Page, classIds: string[]): Promise<void> {
  if (!classIds || classIds.length === 0) return;
  
  await page.click("#clearAll");
  
  const actuallySelected = await page.evaluate((ids) => {
    const select = document.querySelector('select.chosen-select') as HTMLSelectElement;
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
    
    select.dispatchEvent(new Event('change'));
    
    // @ts-ignore - jQuery is available on the page
    if (typeof $ !== 'undefined') {
      // @ts-ignore
      $(".chosen-select").trigger("chosen:updated");
    }
    
    return selectedIds;
  }, classIds);
    
  if (actuallySelected.length > 0) {
    await page.waitForSelector('.chosen-choices .search-choice', { 
      state: 'visible',
      timeout: 3000
    });
  }
}

export async function performTrademarkSearch(
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

  await setWordSearchMatchType(page, wordMatchType);
  await setSearchType(page, searchType);
  await setSearchWords(page, searchWords);

  await selectTrademarkClasses(page, classIds);

  await setFiledBetweenDates(page, fromDate, toDate);
  await setLegalStatus(page, legalStatus);
  await setResultsPerPage(page, resultsPerPage);

  await submitSearchForm(page);

  const trademarks: Array<Trademark> = await getAllTrademarkResults(page);

  return trademarks;
}
