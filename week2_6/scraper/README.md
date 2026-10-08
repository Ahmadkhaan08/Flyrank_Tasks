# Polite Scraper — Books to Scrape

A scraping pipeline that collects 60 books from the first 3 catalogue pages of
Books to Scrape, validates each record against a schema, and writes the results
to JSON.

Stack: Node.js, Cheerio (HTML parsing), Zod (schema validation).

Pipeline: crawl catalogue -> cache HTML -> extract fields -> normalize ->
validate -> write JSON + run report.

---

## Target classification

### Target site

Books to Scrape — https://books.toscrape.com

### Purpose & Permission

A public sandbox environment explicitly made for scraping practice. The site is
published by Zyte (formerly Scrapinghub) as a demo target. Its catalogue is
fictional, so no live business data is involved and no permission request is
required.

### Scope

Strictly the first 3 catalogue pages (60 books):

| Page | URL |
| ---- | --- |
| 1 | https://books.toscrape.com/catalogue/page-1.html |
| 2 | https://books.toscrape.com/catalogue/page-2.html |
| 3 | https://books.toscrape.com/catalogue/page-3.html |

Each catalogue page lists 20 books, so 3 pages = 60 books. The crawler stops
after page 3 even though page 3 still contains a "next" link to page 4.

### Data collected

Title, price, availability, rating, description, and page provenance. No images,
no user data, no login-protected content.

### Robots check result

`https://books.toscrape.com/robots.txt` was requested and returned **404** (no
robots file found).

```bash
curl -I https://books.toscrape.com/robots.txt
# HTTP/1.1 404 Not Found
```

Because no robots file exists, there are no crawl directives to follow. The
scraper still limits itself to the scope above, sends one request at a time, and
waits between requests.

### Why no headless browser

All five fields read from the page (title, price, availability, rating,
description) are present in the raw HTML returned by the server. Nothing is
loaded by JavaScript after the page arrives. Verified with `curl`, which runs no
JavaScript at all:

```bash
curl -s https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html | grep -o '<p class="price_color">[^<]*'
```

```
<p class="price_color">£51.77
```

The price is already in the HTML. The same page contains zero JSON data blobs
and no hydration scripts:

```bash
curl -s https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html | grep -c "application/json\|window.__"
# 0
```

Playwright or Puppeteer would add a browser download and large memory cost while
returning the same HTML this scraper already parses.

### Ethics note

Scraping sends load to someone else's server. This project identifies itself
with a real contact URL in the `User-Agent`, requests one page at a time, waits
between requests, and caches every page locally so repeated runs cost the server
nothing. Where a site offers an official API, the API is the correct choice over
scraping. Where a site publishes a `robots.txt` or terms that forbid scraping,
those rules decide the answer.

I will not reuse this code on another site without checking its rules and terms first.

---

## Requirements

- Node.js 18 or newer (uses the built-in `fetch` and `process.loadEnvFile`)

Verified on Node.js v24.18.0.

## Setup

```bash
npm install
```

That installs the two dependencies and creates `node_modules/`. The settings
file `.env` is optional; the script uses the same values as built-in defaults
when it is missing.

## Run

```bash
npm start
```

First run: about 3 minutes, because it downloads 63 pages with a 2 second gap
between each one. Later runs: under 1 second, because every page is read from
`cache/`.

To see failure handling, add one URL that does not exist:

```bash
npm run test:failure
```

---

## Technical specifications

### Politeness rules

| Rule | Value | Where |
| ---- | ----- | ----- |
| User-Agent header | `FlyRankInternship-A9/1.0 (+https://github.com/Ahmadkhaan08/Flyrank_Tasks)` | Sent on every request |
| Request timeout | 10 seconds | `AbortSignal.timeout` |
| Delay between live requests | 2000 ms (never below 500 ms) | Skipped on cache hits |
| Local HTML caching | `cache/<page>.html` | A page is downloaded once, then reused |
| Pages per run | 3 catalogue + 60 detail = 63 | Hard limit in code |
| Concurrency | 1 request at a time | No parallel requests |

### Retry rules

| Problem | Action |
| ------- | ------ |
| Timeout | Wait 1 second, retry once, then skip the page |
| 5xx server error | Wait 1 second, retry once, then skip the page |
| 404 or 403 | No retry. The server gave a clear answer |

Each page is fetched inside its own `try` / `catch`, so one unreachable page is
counted in `failed_pages` and skipped instead of stopping the run.

### Data schema

Every record must pass this schema before it is written to `output/books.json`.
Records that fail go to `output/errors.json` instead.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `title` | string | Book title, from `h1` |
| `product_url` | string (https URL) | Absolute URL of the detail page |
| `price_text` | string | Price exactly as shown, e.g. `"£51.77"` |
| `price_gbp` | number > 0 | Price as a number for sorting and maths, e.g. `51.77` |
| `availability_text` | string | Stock line, e.g. `"In stock (22 available)"` |
| `rating_text` | string | Rating word from the CSS class, e.g. `"Three"` |
| `description` | string or null | Product description; `null` when the page has none |
| `source_page` | string | Catalogue page URL where the book was discovered |
| `fetched_at` | string (ISO) | When the HTML was downloaded |

Missing values are never invented. A field with no text becomes `null`, which
fails the schema for every field except `description`.

### Settings

Optional. Copy `.env.example` to `.env` to change them.

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `BASE_URL` | `https://books.toscrape.com/catalogue/` | Where the catalogue pages are |
| `USER_AGENT` | `FlyRankInternship-A9/1.0 (+https://github.com/Ahmadkhaan08/Flyrank_Tasks)` | Identifies the scraper |
| `TIMEOUT_MS` | `10000` | How long to wait for a response |
| `DELAY_MS` | `2000` | Delay between live requests (values below 500 are raised to 500) |

---

## Project structure

```
scraper/
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── cache/                   (created at runtime, not committed)
├── output/                  (created at runtime, not committed)
│   ├── books.json           (valid records)
│   ├── errors.json          (rejected records and the reason)
│   └── run-report.json      (counts and timings)
└── src/
    └── index.js
```

### Files not tracked in Git

`cache/` and `output/` are both listed in `.gitignore`, so no downloaded HTML
and no generated JSON is committed. Confirm it:

```bash
git check-ignore -v cache output
```

Expected output (the path shown depends on where the repository root is):

```
week2_6/scraper/.gitignore:5:cache/    cache
week2_6/scraper/.gitignore:6:output/   output
```

`git status` stays clean after a run, which confirms no cache or output file is
picked up by Git.

---

## Evidence of run

### First run, empty cache

`output/run-report.json` after `npm start` with no `cache/` folder:

```json
{
  "start_time": "2026-10-08T18:08:17.550Z",
  "duration_seconds": 171.32,
  "pages_fetched": 63,
  "cache_hits": 0,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

63 live requests = 3 catalogue pages + 60 detail pages. 60 records validated,
none rejected, none failed.

### Second run, cache present

```json
{
  "start_time": "2026-10-08T18:07:47.376Z",
  "duration_seconds": 0.59,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

`pages_fetched: 0` means the second run sent no requests to the server at all.

### Failure handling, `npm run test:failure`

```json
{
  "start_time": "2026-10-08T17:54:52.896Z",
  "duration_seconds": 1.5,
  "pages_fetched": 1,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 1
}
```

One broken URL was added on purpose. It returned 404, was not retried, and was
counted in `failed_pages`. All 60 real records survived and the script exited
with code 0.

---

## Verification

Run these after `npm start`.

### 1. Exactly 60 records, all URLs https, no duplicates

```bash
node -e "const b=require('./output/books.json'); console.log('records:', b.length); console.log('unique urls:', new Set(b.map(x => x.product_url)).size); console.log('all https:', b.every(x => x.product_url.startsWith('https://')));"
```

Expected:

```
records: 60
unique urls: 60
all https: true
```

### 2. Rerunning does not duplicate records

```bash
npm start
node -e "console.log('records after rerun:', require('./output/books.json').length);"
```

Expected:

```
records after rerun: 60
```

Both output files are rewritten from scratch on every run, so repeated runs
produce the same 60 records instead of appending.

### 3. No validation errors

```bash
node -e "console.log('rejected records:', require('./output/errors.json').length);"
```

Expected:

```
rejected records: 0
```

### 4. A sample record

```bash
node -e "console.log(JSON.stringify(require('./output/books.json')[0], null, 2));"
```

Expected shape:

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "price_gbp": 51.77,
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "It's hard to imagine a world without A Light in the Attic...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-10-08T18:08:27.127Z"
}
```

---

## Dependencies

| Package | Version | Why it is needed |
| ------- | ------- | ---------------- |
| cheerio | 1.2.0 | Reads HTML and finds elements by CSS selector |
| zod | 4.6.5 | Checks every record against a schema before it is saved |

No headless browser and no threading library. HTTP requests use the `fetch`
function built into Node.js, and `.env` is read by `process.loadEnvFile()`, so
no `axios` or `dotenv` package is needed.
