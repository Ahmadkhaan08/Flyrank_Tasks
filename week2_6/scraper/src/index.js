// Polite scraper for https://books.toscrape.com
// Scope: the first 3 catalogue pages only (60 books).
// This step fetches catalogue page 1 and caches it on disk.

const fs = require("fs");
const path = require("path");

// Load the settings from the .env file sitting next to this project.
const ENV_FILE = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// Read each setting from .env, with a safe default if it is missing.
const BASE_URL = process.env.BASE_URL || "https://books.toscrape.com/catalogue/";
const USER_AGENT = process.env.USER_AGENT || "PoliteScraper/1.0 (learning project)";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 10000;

// The cache folder lives next to the scraper folder, not inside src/.
const CACHE_DIR = path.join(__dirname, "..", "cache");

// Returns the HTML for a URL, using the cache file when it is already there.
async function fetchWithCache(url, cacheFilePath) {
  // 1. Use the saved copy if we already downloaded this page before.
  if (fs.existsSync(cacheFilePath)) {
    const cachedHtml = fs.readFileSync(cacheFilePath, "utf8");
    console.log("[CACHE HIT] " + url + " (" + Buffer.byteLength(cachedHtml) + " bytes)");
    return cachedHtml;
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
  return html;
}

async function main() {
  const url = BASE_URL + "page-1.html";
  const cacheFilePath = path.join(CACHE_DIR, "catalogue-page-1.html");

  const html = await fetchWithCache(url, cacheFilePath);

  // Never print the HTML itself, only its size.
  console.log("Page 1 ready: " + Buffer.byteLength(html) + " bytes of HTML");
}

main().catch((error) => {
  console.error("Scraper stopped:", error.message);
  process.exit(1);
});
