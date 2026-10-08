// Polite scraper for https://books.toscrape.com
// Scope: the first 3 catalogue pages only (60 books).
// Steps: crawl the catalogue, read 8 fields per book, clean and check them,
// then save the good records to output/books.json.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { z } = require("zod");

// Load the settings from the .env file sitting next to this project.
const ENV_FILE = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// Read each setting from .env, with a safe default if it is missing.
const BASE_URL = process.env.BASE_URL || "https://books.toscrape.com/catalogue/";
const USER_AGENT = process.env.USER_AGENT || "PoliteScraper/1.0 (learning project)";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 10000;

// Never go faster than one request every 500ms, even if .env asks for less.
const MIN_DELAY_MS = 500;
const DELAY_MS = Math.max(MIN_DELAY_MS, Number(process.env.DELAY_MS) || 2000);

// Stop after this many catalogue pages. This is the whole agreed scope.
const MAX_PAGES = 3;

// These folders live next to the scraper folder, not inside src/.
const CACHE_DIR = path.join(__dirname, "..", "cache");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const BOOKS_FILE = path.join(OUTPUT_DIR, "books.json");
const ERRORS_FILE = path.join(OUTPUT_DIR, "errors.json");

// The shape every record must have before it is allowed into books.json.
const bookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url().startsWith("https://"),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.string().min(1),
  description: z.string().nullable(),
  source_page: z.string().min(1),
  fetched_at: z.string().min(1),
});

// Waits for the given number of milliseconds.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns messy HTML whitespace into a single clean line.
// Returns null when there is no real text, so we never invent a value.
function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

// Reads the number out of a price string: "£51.77" -> 51.77
// Returns null when there is no number, so a bad price is never guessed.
function parsePriceToNumber(priceText) {
  if (typeof priceText !== "string") {
    return null;
  }

  // Keep only digits and the decimal point, dropping "£" and any spaces.
  const digitsOnly = priceText.replace(/[^0-9.]/g, "");
  const price = parseFloat(digitsOnly);

  return Number.isFinite(price) ? price : null;
}

// Builds the cache file name for a book from the last part of its URL.
// ".../catalogue/a-light-in-the-attic_1000/index.html" -> "a-light-in-the-attic_1000"
function bookIdFromUrl(url) {
  const parts = new URL(url).pathname.split("/");

  // The last part is "index.html", so the book folder is the one before it.
  return parts[parts.length - 2];
}

// Returns { html, fromCache, fetchedAt } for a URL, using the cache when possible.
// "fromCache" tells the caller whether a polite delay is needed.
// "fetchedAt" is when the HTML was really downloaded, not when it was read.
async function fetchWithCache(url, cacheFilePath) {
  // 1. Use the saved copy if we already downloaded this page before.
  if (fs.existsSync(cacheFilePath)) {
    const cachedHtml = fs.readFileSync(cacheFilePath, "utf8");
    const savedAt = fs.statSync(cacheFilePath).mtime.toISOString();

    console.log("[CACHE HIT] " + url + " (" + Buffer.byteLength(cachedHtml) + " bytes)");
    return { html: cachedHtml, fromCache: true, fetchedAt: savedAt };
  }

  // 2. No saved copy, so download the page.
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error("Request timed out after " + TIMEOUT_MS + "ms: " + url);
    }
    throw new Error("Request failed for " + url + ": " + error.message);
  }

  // 3. Only a 200 response is treated as usable HTML.
  if (response.status !== 200) {
    throw new Error("Expected status 200 but got " + response.status + " for " + url);
  }

  const html = await response.text();

  // 4. Make sure the cache folder exists, then save the HTML.
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFilePath, html, "utf8");

  console.log("[FETCH] " + url + " (" + Buffer.byteLength(html) + " bytes)");
  return { html, fromCache: false, fetchedAt: new Date().toISOString() };
}

// Finds every book detail link on a catalogue page.
// Returns absolute URLs, because the page itself uses relative links.
function extractBookLinks($, pageUrl) {
  const links = [];

  $("article.product_pod h3 a").each((index, element) => {
    const href = $(element).attr("href");

    // Skip a link that has no href instead of crashing on it.
    if (!href) {
      return;
    }

    // new URL() turns "the-book_123/index.html" into a full https:// address.
    links.push(new URL(href, pageUrl).href);
  });

  return links;
}

// Reads the "next" button from the pagination markup.
// Returns the absolute URL of the next page, or null when there is none.
function findNextPageUrl($, pageUrl) {
  const href = $("li.next a").attr("href");

  if (!href) {
    return null;
  }

  return new URL(href, pageUrl).href;
}

// Reads the rating word out of the class list, for example:
// class="star-rating Three" -> "Three"
// Only div.product_main is searched, because the "you may also like" row
// further down the page has star ratings for other books.
function extractRatingText($) {
  const classList = $("article.product_page div.product_main p.star-rating").attr("class");

  if (!classList) {
    return null;
  }

  const words = classList.split(/\s+/).filter(function (word) {
    return word !== "star-rating" && word !== "";
  });

  return words.length === 0 ? null : words[0];
}

// Reads the product description paragraph.
// Some books have no description, and those must stay null.
function extractDescription($) {
  const paragraph = $("article.product_page #product_description ~ p").first();

  if (paragraph.length === 0) {
    return null;
  }

  return cleanText(paragraph.text());
}

// Pulls the raw fields out of one book detail page and cleans them.
function extractBookRecord(html, productUrl, sourcePage, fetchedAt) {
  const $ = cheerio.load(html);

  // div.product_main holds this book's own details. The rest of the page has a
  // "you may also like" row whose books also use p.price_color and p.instock,
  // so searching the whole page could pick up the wrong book's values.
  const product = $("article.product_page div.product_main");

  // cleanText() already removes the extra spaces and newlines from the HTML.
  const title = cleanText(product.find("h1").first().text());
  const priceText = cleanText(product.find("p.price_color").first().text());
  const availabilityText = cleanText(product.find("p.instock.availability").first().text());

  return {
    title: title,
    product_url: productUrl,
    price_text: priceText,
    price_gbp: parsePriceToNumber(priceText),
    availability_text: availabilityText,
    rating_text: extractRatingText($),
    description: extractDescription($),
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}

// Visits the 3 catalogue pages and returns a Map of
// book URL -> the catalogue page it was discovered on.
async function crawlCatalogue() {
  const discoveredBooks = new Map();
  let cataloguePages = 0;
  let discovered = 0;

  // Start at page 1 and let the pagination tell us where to go next.
  let currentUrl = new URL("page-1.html", BASE_URL).href;

  while (currentUrl !== null && cataloguePages < MAX_PAGES) {
    const pageNumber = cataloguePages + 1;
    const cacheFilePath = path.join(CACHE_DIR, "catalogue-page-" + pageNumber + ".html");

    const result = await fetchWithCache(currentUrl, cacheFilePath);
    cataloguePages++;

    // Hand the HTML to Cheerio so we can search it with CSS selectors.
    const $ = cheerio.load(result.html);

    const bookLinks = extractBookLinks($, currentUrl);
    discovered += bookLinks.length;

    // A Map keeps one entry per URL, so duplicates disappear by themselves.
    // The value remembers which catalogue page the book came from.
    for (const link of bookLinks) {
      if (!discoveredBooks.has(link)) {
        discoveredBooks.set(link, currentUrl);
      }
    }

    const nextUrl = findNextPageUrl($, currentUrl);
    const hasAnotherPageToFetch = nextUrl !== null && cataloguePages < MAX_PAGES;

    // Be polite: pause before the next live request, but not after a cache hit
    // and not when we are already finished.
    if (hasAnotherPageToFetch && result.fromCache === false) {
      await sleep(DELAY_MS);
    }

    currentUrl = hasAnotherPageToFetch ? nextUrl : null;
  }

  console.log(
    "catalogue_pages = " + cataloguePages +
    ", discovered = " + discovered +
    ", unique_urls = " + discoveredBooks.size
  );

  return discoveredBooks;
}

// Visits every book page and returns one cleaned record per book.
async function scrapeBookPages(discoveredBooks) {
  const records = [];
  const bookEntries = Array.from(discoveredBooks.entries());

  for (let index = 0; index < bookEntries.length; index++) {
    const productUrl = bookEntries[index][0];
    const sourcePage = bookEntries[index][1];

    const bookId = bookIdFromUrl(productUrl);
    const cacheFilePath = path.join(CACHE_DIR, "book-" + bookId + ".html");

    const result = await fetchWithCache(productUrl, cacheFilePath);
    records.push(extractBookRecord(result.html, productUrl, sourcePage, result.fetchedAt));

    // Pause before the next live request, but not after the last book
    // and not after a cache hit.
    const isLastBook = index === bookEntries.length - 1;
    if (!isLastBook && result.fromCache === false) {
      await sleep(DELAY_MS);
    }
  }

  return records;
}

// Checks every record against the schema and splits them into two lists.
// Nothing that fails the schema can reach the valid list.
function validateRecords(records) {
  const validRecords = [];
  const invalidRecords = [];

  for (const record of records) {
    const result = bookSchema.safeParse(record);

    if (result.success) {
      validRecords.push(result.data);
      continue;
    }

    // Turn Zod's issue list into short, readable reasons.
    const reasons = result.error.issues.map(function (issue) {
      const fieldName = issue.path.join(".") || "(record)";
      return fieldName + ": " + issue.message;
    });

    invalidRecords.push({ record: record, errors: reasons });
  }

  return { validRecords, invalidRecords };
}

// Writes pretty JSON to a file, replacing whatever was there before.
// Overwriting is what makes repeated runs safe to do.
function writeJsonFile(filePath, data) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote " + path.basename(filePath) + " (" + data.length + " records)");
}

async function main() {
  const discoveredBooks = await crawlCatalogue();
  const records = await scrapeBookPages(discoveredBooks);

  console.log("detail_pages = " + records.length);

  const checked = validateRecords(records);

  // Both files are rewritten every run, so old results never pile up.
  writeJsonFile(BOOKS_FILE, checked.validRecords);
  writeJsonFile(ERRORS_FILE, checked.invalidRecords);

  // Show one whole record so the field shapes are easy to check.
  if (checked.validRecords.length > 0) {
    console.log("");
    console.log("Sample valid record:");
    console.log(JSON.stringify(checked.validRecords[0], null, 2));
  }

  console.log("");
  console.log(
    "valid = " + checked.validRecords.length +
    ", invalid = " + checked.invalidRecords.length
  );
}

main().catch(function (error) {
  console.error("Scraper stopped:", error.message);
  process.exit(1);
});
