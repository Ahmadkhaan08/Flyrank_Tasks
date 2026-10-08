// Polite scraper for https://books.toscrape.com
// Scope: the first 3 catalogue pages only (60 books).
// This step crawls the 3 pages, follows the "next" link, and collects
// the URL of every book detail page it finds.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

// The cache folder lives next to the scraper folder, not inside src/.
const CACHE_DIR = path.join(__dirname, "..", "cache");

// Waits for the given number of milliseconds.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns { html, fromCache } for a URL, using the cache file when it exists.
// "fromCache" is returned so the caller knows whether a delay is needed.
async function fetchWithCache(url, cacheFilePath) {
  // 1. Use the saved copy if we already downloaded this page before.
  if (fs.existsSync(cacheFilePath)) {
    const cachedHtml = fs.readFileSync(cacheFilePath, "utf8");
    console.log("[CACHE HIT] " + url + " (" + Buffer.byteLength(cachedHtml) + " bytes)");
    return { html: cachedHtml, fromCache: true };
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
  return { html, fromCache: false };
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

async function main() {
  const uniqueUrls = new Set();
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

    // A Set keeps one copy of each URL, so duplicates disappear by themselves.
    for (const link of bookLinks) {
      uniqueUrls.add(link);
    }

    console.log("  page " + pageNumber + ": found " + bookLinks.length + " book links");

    const nextUrl = findNextPageUrl($, currentUrl);
    const hasAnotherPageToFetch = nextUrl !== null && cataloguePages < MAX_PAGES;

    // Be polite: pause before the next live request, but not after a cache hit
    // and not when we are already finished.
    if (hasAnotherPageToFetch && result.fromCache === false) {
      console.log("  waiting " + DELAY_MS + "ms before the next request");
      await sleep(DELAY_MS);
    }

    currentUrl = hasAnotherPageToFetch ? nextUrl : null;
  }

  console.log(
    "catalogue_pages = " + cataloguePages +
    ", discovered = " + discovered +
    ", unique_urls = " + uniqueUrls.size
  );
}

main().catch((error) => {
  console.error("Scraper stopped:", error.message);
  process.exit(1);
});
