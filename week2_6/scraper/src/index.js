// Polite scraper for https://books.toscrape.com
// Scope: the first 3 catalogue pages only (60 books).

const BASE_URL = "https://books.toscrape.com/catalogue/";
const TOTAL_PAGES = 3;
const DELAY_MS = 2000;
const USER_AGENT = "PoliteScraper/1.0 (learning project)";

// Waits for the given number of milliseconds.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Downloads one page and returns its HTML as text.
async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error("Request failed for " + url + " (status " + response.status + ")");
  }

  return response.text();
}

async function main() {
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = BASE_URL + "page-" + page + ".html";

    console.log("Fetching page " + page + ": " + url);
    const html = await fetchPage(url);
    console.log("Received " + html.length + " characters");

    // Parsing and saving are added in the next step.

    // Wait before the next request so the server is not overloaded.
    if (page < TOTAL_PAGES) {
      console.log("Waiting " + DELAY_MS + "ms before the next request");
      await sleep(DELAY_MS);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("Scraper stopped:", error.message);
  process.exit(1);
});
