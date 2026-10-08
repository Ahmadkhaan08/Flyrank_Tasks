# Polite Scraper

A small Node.js scraper that collects book data from a public practice site.

---

## Target classification

### Target site

Books to Scrape — https://books.toscrape.com

### Purpose & Permission

A public sandbox environment explicitly made for scraping practice. The site is
published by Zyte (formerly Scrapinghub) as a demo target. Its content is
fictional and no permission request is required to scrape it.

### Scope

Strictly the first 3 catalogue pages (60 books):

| Page | URL |
| ---- | --- |
| 1 | https://books.toscrape.com/catalogue/page-1.html |
| 2 | https://books.toscrape.com/catalogue/page-2.html |
| 3 | https://books.toscrape.com/catalogue/page-3.html |

Each catalogue page lists 20 books, so 3 pages = 60 books. No page 4 or beyond.
No other domain.

### Data collected

| Field | Source |
| ----- | ------ |
| Title | Book listing and detail page |
| Price | Book listing and detail page |
| Availability | Stock text on the detail page |
| Rating | Star rating class on the listing |
| Description | Product description on the detail page |
| Page provenance | Catalogue page number and the detail page URL the record came from |

No images, no user data, no login-protected content.

### Robots check result

`https://books.toscrape.com/robots.txt` was requested and returned **404** (no
robots file found).

```
$ curl -I https://books.toscrape.com/robots.txt
HTTP/2 404
```

Because no robots file exists, there are no crawl directives to follow. The
scraper still limits itself to the scope above, sends one request at a time, and
waits between requests.

### Pledge

I will not reuse this code on another site without checking its rules and terms first.

---

## Project structure

```
scraper/
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── cache/            (created at runtime, not committed)
└── src/
    └── index.js
```

## Requirements

- Node.js 18 or newer (uses the built-in `fetch`)

## Setup

```bash
cd week2_6/scraper
npm install
cp .env.example .env
```

## Settings

All settings live in `.env`. Copy `.env.example` to `.env` before the first run.
`.env` is ignored by git; `.env.example` is committed so the values are visible.

| Variable | Example value | Meaning |
| -------- | ------------- | ------- |
| `BASE_URL` | `https://books.toscrape.com/catalogue/` | Where the catalogue pages are |
| `USER_AGENT` | `FlyRankInternship-A9/1.0 (+https://github.com/Ahmadkhaan08/Flyrank_Tasks)` | Identifies the scraper and gives the site owner a contact link |
| `TIMEOUT_MS` | `10000` | How long to wait for a response |
| `DELAY_MS` | `2000` | How long to wait between requests |

The file is read by `process.loadEnvFile()`, which is built into Node.js 20.12
and newer, so no `dotenv` package is needed. If a variable is missing the script
falls back to a safe default instead of crashing.

## Run

```bash
npm start
```

## Dependencies

| Package | Why it is needed |
| ------- | ---------------- |
| cheerio | Reads HTML and finds elements by CSS selector |

No headless browser and no threading library. HTTP requests use the `fetch`
function that is already built into Node.js.
