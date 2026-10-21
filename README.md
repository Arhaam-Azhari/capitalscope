# CapitalScope

I built CapitalScope to connect SEC financial evidence, explicit valuation assumptions, saved research, and simulated portfolios in one finance workbench. I use React/TypeScript, Java/Spring Boot, API integrations, JDBC, Flyway, and PostgreSQL/H2.

I have finished the scoped portfolio release. I describe the verified launch path, test coverage, and remaining provider/container checks in [my release notes](docs/portfolio-release.md). I keep accounts and broader product work separate from this release.

I gave CapitalScope a warm ivory and copper identity, with serif company titles, an editorial metric strip, and horizontal navigation. I checked it against my LedgerDesk UI so the projects have different colors, typography, and layouts. I keep tables readable and let wide evidence tables scroll on smaller screens.

![My company research workspace with explicitly labeled example figures](docs/research-dashboard.png)

I also keep a [mobile screenshot](docs/research-dashboard-mobile.png) of the same example workspace.

I use this [short demo walkthrough](docs/demo-walkthrough.md) to show the research, valuation, portfolio, and price-analysis flows. It includes a key-free route, a small calculation I can check, and the limits I explain when presenting the project.

## Run the app

I can run the verified jar route with Java 17, Maven 3.9+, and Node.js 22:

```bash
bash scripts/build.sh
java -jar backend/target/capitalscope-0.1.0.jar
```

I open http://localhost:8080. The default jar launch uses a local H2 database under `./data`; I keep that directory when I want to retain saved work. I use the no-key demo before configuring live providers.

### Docker alternative

I verify the Docker image and Compose/PostgreSQL path in CI with [my container check](docs/container-check.md), including non-root database writes and saved-work persistence across container recreation. My original local release verification used the jar route.


With Docker installed, copy `.env.example` to `.env` and set `DATABASE_PASSWORD` to a password for the local database:

```bash
docker compose up --build
```

Open http://localhost:8080. The app starts in a clearly labeled example workspace with invented figures. The company catalog and calculator work without API keys.

For real SEC imports, copy `.env.example` to `.env`, set `SEC_USER_AGENT` to an app name and a real contact email, and restart. I don't include contact information or credentials in the repository. Upstream failures are reported rather than replaced with example numbers.

## What I can do

- I research 50 catalog companies using SEC annual facts, accounting tags, source links, matched-period ratios, and explicit missing-data states.
- I compare two to four companies, inspect fiscal-period differences, and save reusable peer groups and chart measures.
- I build FCFF valuation cases, inspect projected cash flows and sensitivity, save assumptions, and compare modeled results.
- I keep shared theses, risks, review dates, manual checklists, and revision history, with separate browser-only notes.
- I inspect dated raw prices, drawdowns, shared-date comparisons, coverage gaps, and saved comparison setups.
- I record manual simulated portfolio events, inspect cash/holdings and dated valuations, and explore allocation targets and explicit price shocks.
- I export source-aware CSVs, download a loaded research-evidence JSON file, and print a company summary. I retain sources, timestamps, assumptions, and unavailable-value reasons where relevant.

I start with a clearly labeled fictional workspace for a key-free demo. I do not send broker orders, provide live intraday quotes, or present the shared database as private user accounts.

I selected the top 50 American companies from the CompaniesMarketCap ranking observed on October 6, 2026, using one ticker per company. This is a fixed snapshot, not a live ranking. [Company universe](docs/company-universe.md).

Catalog source: https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/

I haven't verified live data coverage for all 50 companies. Recently listed companies may have no annual 10-K facts, and some issuers use unsupported tags. Missing data stays missing.

## Development setup

I use Java 17, Maven 3.9+, and Node.js 22.

Terminal 1:

```bash
export SEC_USER_AGENT='CapitalScope your-real-contact-address'
cd backend
mvn spring-boot:run
```

Terminal 2:

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` to port 8080. Set `CAPITALSCOPE_API_TARGET` in a frontend `.env` file to use another backend.

To build one runnable jar containing both the dashboard and backend:

```bash
bash scripts/build.sh
java -jar backend/target/capitalscope-0.1.0.jar
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/data-connections` | I read configuration-presence flags and a check timestamp, without contacting providers or exposing values |
| `GET /api/research/comparison-setups` | I list shared saved peer groups and chart measures |
| `POST /api/research/comparison-setups` | I save `{name, tickers, measure}` selections without financial figures |
| `DELETE /api/research/comparison-setups/{id}` | I remove a saved peer setup |
| `GET /api/companies/{ticker}/price-comparison-setups` | I list saved comparison inputs for a market company |
| `POST /api/companies/{ticker}/price-comparison-setups` | I save `{name, referenceTicker, startDate, endDate}` without fetching prices |
| `DELETE /api/companies/{ticker}/price-comparison-setups/{id}` | I delete a setup scoped to its current company |
| `GET /api/companies/{ticker}/prices` | Cached daily raw prices from Alpha Vantage |
| `GET /api/examples/prices` | Invented price series for the fictional company |
| `GET /api/watchlist` | Shared saved research shortlist |
| `PUT /api/watchlist/{ticker}` | Save thesis, risks, status, optional review date, and expected version and entry ID |
| `DELETE /api/watchlist/{ticker}?version=…&entryId=…` | Remove the active entry using its saved version; retain revision history |
| `GET /api/watchlist/{ticker}/history?before=…` | Read 20 saved revisions at a time with an optional cursor |
| `GET /api/watchlist/{ticker}/history/export.csv` | Export all recorded revisions for one company, oldest record first |
| `GET /api/portfolios/{id}/allocation-targets` | I list saved percentage mixes for this portfolio |
| `POST /api/portfolios/{id}/allocation-targets` | I save `{name, targets}` with Cash and exactly the current holding tickers; percentages must total 100 |
| `DELETE /api/portfolios/{id}/allocation-targets/{targetId}` | I delete one saved mix without changing trades |
| `GET /api/portfolios/{id}/stress-scenarios/{scenarioId}/export.csv` | I download the saved assumptions, results, and price evidence without recalculating |
| `GET /api/portfolios/{id}/stress-scenarios` | I review saved stress snapshots for this portfolio |
| `POST /api/portfolios/{id}/stress-scenarios` | I save `{name, assumptions}` after calculating the current server baseline |
| `DELETE /api/portfolios/{id}/stress-scenarios/{scenarioId}` | I delete one saved stress snapshot |
| `POST /api/portfolios/{id}/stress` | I apply `{defaultShock, sectorShocks}` as decimal price changes to server-held positions; cash stays fixed |
| `GET /api/portfolios/{id}/valuation` | Current holdings at stored closes; partial coverage with missing totals |
| `GET /api/portfolios/{id}/export.csv` | Ordered simulated events, starting cash, exact decimal inputs |
| `GET /api/companies/{ticker}/financials/export.csv` | Annual facts with units, tags, dates, and sources |
| `GET /api/examples/financials/export.csv` | Clearly marked fictional facts |
| `GET /api/portfolios` | Shared practice portfolios |
| `POST /api/portfolios` | Create `{name, mode, initialCash}` |
| `GET /api/portfolios/{id}` | Cash, holdings, and recorded fills |
| `POST /api/portfolios/{id}/actions` | Record a simulated split or dividend with a request UUID |
| `POST /api/portfolios/{id}/trades` | Record `{requestId, ticker, side, quantity, price, fee}` |
| `GET /api/companies` | Company catalog |
| `GET /api/universe` | Snapshot date and selection metadata |
| `GET /api/companies/{ticker}/financials` | Sourced annual SEC facts |
| `GET /api/examples/comparisons` | Three fictional peer reports for exploring comparisons |
| `GET /api/examples/financials` | Explicitly labeled invented example |
| `POST /api/valuations/dcf/sensitivity` | Same assumptions; 25 model evaluations with invalid cells marked |
| `POST /api/valuations/dcf` | Generic FCFF calculator |
| `GET /api/companies/{ticker}/scenarios/price-context` | I compare saved models with a local dated close; gaps require `shareBasisConfirmed=true` |
| `GET /api/companies/{ticker}/scenarios` | Saved versions for a company (`DEMO` is separate) |
| `POST /api/companies/{ticker}/scenarios` | Save `{name, assumptions}`; results calculated on the server |
| `DELETE /api/companies/{ticker}/scenarios/{id}` | Delete one saved version |

Example valuation request:

```bash
curl -X POST http://localhost:8080/api/valuations/dcf \
  -H 'Content-Type: application/json' \
  -d '{"baseFreeCashFlow":100000000,"growthRate":0.05,"discountRate":0.10,"terminalGrowthRate":0.02,"years":5,"netDebt":200000000,"sharesOutstanding":50000000}'
```

Saved allocation targets use percentage units (`40` means 40%), with up to two decimal places. I include `Cash` even when its target is zero. These are reusable inputs, not valuation snapshots.

These inputs are invented. API rates use decimals (`0.10` means 10%); the interface accepts percentages (`10` means 10%). Money and shares use full units, not millions.

## Model assumptions

I discount **unlevered free cash flow to the firm** using WACC, subtract net debt, and divide equity value by shares outstanding. Negative net debt represents net cash. Reported operating cash flow minus capex isn't automatically unlevered cash flow; model inputs stay separate from the financial report.

This version uses positive starting cash flow, constant growth, and a Gordon-growth terminal value. It doesn't adjust for changing share counts, excess assets, every non-debt claim, or loss-making businesses. Negative equity estimates remain negative. Results disappear when inputs change.

The interface disables the general model for banks, broker-dealers, Berkshire Hathaway, and UnitedHealth in the catalog. These businesses need specialized methods. The generic API itself is not tied to a company ticker.

## Data and storage

Successful SEC responses are stored in the database and reused for six hours, including after a restart. Expired entries are refreshed; an upstream failure does not silently serve stale figures. Outbound requests are spaced at least one second apart. Reports show both retrieval and response timestamps. Shared rate limiting is needed before running multiple backend instances.

I select annual USD facts from supported standard US-GAAP tags, prefer the first supported tag, fill missing periods from alternatives, and keep the latest-filed value per period within a tag. Restatements may change earlier years; cash balances can include comparative dates. This is **not point-in-time data for backtesting**. Fiscal calendars differ across companies.

Source links lead to each filing's SEC archive directory. The fictional example company is separate from the real catalog and has no filing sources.

Research notes are browser-local plain text, without cloud sync. Clearing browser storage removes them. Save failures are shown. Valuation scenarios are stored in the app database with their inputs, calculated outputs, creation date, and model version. Saving again creates another version; editing inputs clears the displayed result until I recalculate.

Docker Compose uses PostgreSQL 17 with a named volume. Local Java runs use a file-backed H2 database at `./data/capitalscope`, relative to the working directory. I use Flyway migrations for both. To connect Java directly to PostgreSQL, set `DATABASE_URL` to a JDBC URL, `DATABASE_USER`, and `DATABASE_PASSWORD`. Keep backups of the database before removing volumes or changing storage.

This is a single shared research workspace without accounts. Saved scenarios are visible to everyone who can reach the app. Compose binds the app to localhost. I still need user accounts and private workspaces. Daily price history and simulated portfolios are available; performance returns and provider-verified corporate actions are not. I can value current holdings from stored daily closes and record manual practice events.

SEC API reference: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

## Checks

```bash
cd backend
mvn verify
```

```bash
cd frontend
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

```bash
bash scripts/check-valuation.sh
bash scripts/build.sh
bash scripts/smoke-test.sh
npm run test:integration --prefix frontend
```

I check valuation math against a constant-cash-flow perpetuity, annual selection against synthetic filings, and HTTP behavior in a Spring application context. Browser tests use stubbed APIs to check search, sources, stale requests, missing data, percentage conversion, notes, and mobile layout. Persistence checks reopen a file database and verify stored snapshots, timestamps, assumptions, and outputs. CI runs the API checks against PostgreSQL. Separate integration tests run against the packaged Spring app without intercepting API requests. They do not establish live SEC coverage. The packaged-app check starts the jar and verifies dashboard assets and APIs together.

GitHub Actions runs backend/package checks and frontend/browser checks on pushes and pull requests. A separate Backend checks job builds the Docker image and verifies standalone H2 and Compose/PostgreSQL persistence; I describe its scope in [my container check](docs/container-check.md).

## My portfolio release finish line

I completed the performance, workflow-review, and release-documentation passes. I record the completed scope and later product work in [my release checklist](docs/release-checklist.md).

## Later product work

1. Verify live imports and improve accounting-tag coverage.
2. Add accounts and move notes into private research workspaces.
3. Improve peer selection and expand sector-specific models.
4. Add verified price adjustments and trade corrections.
5. Add benchmarks and portfolio risk analysis.

## How I compare companies

I show each company’s latest annual revenue period and match income, operating cash flow, and capex to the same start and end dates. I leave missing or mismatched values blank. Revenue growth uses the preceding annual period 300–400 days earlier and needs positive prior revenue. Margins need positive current revenue. I retain negative income and cash-after-capex values.

I show both periods for growth and the underlying filing links for derived measures. Companies can have different fiscal calendars, business models, and accounting treatments; I use this table for research, not a stock ranking. Reported operating cash flow minus capex is not automatically FCFF. I keep the invented comparison peers separate from real companies.

## How I check valuation sensitivity

I evaluate 25 combinations with the same DCF calculator. I vary WACC in one-percentage-point steps and terminal growth in half-percentage-point steps around my base case. I hold the other inputs fixed and mark the center result. I leave invalid cells unavailable, including nonpositive discount rates and terminal growth at or above WACC. I clear the table when I change model inputs.

## How I import prices

I use Alpha Vantage’s `TIME_SERIES_DAILY` compact response, which provides up to 100 recent daily observations. I set `ALPHA_VANTAGE_API_KEY` on the backend, keep it out of responses and stored source URLs, and cache successful imports in the database for 24 hours. I space requests 13 seconds apart within one app instance; provider limits and plan restrictions still apply. I show upstream errors without replacing real prices with example numbers. I have not verified coverage for all 50 tickers.

I validate the ticker, dates, OHLC ranges, positive prices, and nonnegative integer volumes. These are raw prices: I do not adjust for splits or dividends, calculate total returns, or claim real-time quotes. I need provider-verified corporate-action adjustments before using this series for backtesting or portfolio performance.

Provider reference: https://www.alphavantage.co/documentation/#daily

## How I track practice portfolios

I start with a fixed USD cash deposit, record manual simulated fills, and calculate positions from the stored trade history. My example portfolios only accept the fictional DEMO instrument; my catalog portfolios use real ticker names but still contain simulated trades. I do not connect a broker or infer a fill from a daily close.

I use decimal arithmetic, up to six decimals for shares, four for fill prices, and two for fees. I include buy fees in weighted-average cost and deduct sell fees from realized P&L. I round prorated cost to ten decimals and remove the entire remaining basis when a position closes. This is a practice accounting convention, not tax-lot reporting. I reject negative inputs, insufficient cash, overselling, and sell fees above proceeds.

I lock each portfolio row while recording a fill and require a request UUID. Retrying the same fill with the same UUID does not create another trade; reusing it with changed inputs fails. I keep the recorded fills append-only. Corrections, external deposits, provider-verified corporate actions and portfolio return calculations are still to come. Everyone who can access this shared app can see portfolios and record trades.

## How I record simulated splits and dividends

I replay trades and manual company events in one database sequence, including trades saved before this feature. I record new events at the current time and apply them to the position held then. I do not backdate entitlements or treat these inputs as verified market events.

For a split, I enter integer new-share and old-share terms, such as 2:1 or 1:10. I change the share count while preserving total cost basis, then recalculate average cost. I reject results requiring more than six decimals rather than invent cash in lieu. For a dividend, I enter a USD amount per share, credit current shares times that amount to cash, and show dividend income separately from realized trading P&L. I do not model withholding, reinvestment, return of capital, or ex-date eligibility.

I use the same row lock and request UUID checks for trades and actions. I reject a UUID reused across different event types or terms. These practice events do not adjust the Alpha Vantage price series, so I still need verified adjustments before reporting portfolio returns.

## How I export my research

I can download annual facts with their original decimal values, units, period dates, filing evidence, accounting tags, data mode, and retrieval timestamp. I keep missing metrics as blank rows rather than writing zeros. I also export portfolio events in recorded order, starting with the initial cash deposit, and mark every row as simulated. I include manual fill prices, fees, split ratios, and dividends so I can inspect the history in a spreadsheet.

I export UTF-8 CSV, escape commas, quotes, and line breaks, and protect user-entered text that could be interpreted as a spreadsheet formula. I preserve decimal numbers in the CSV text; spreadsheet applications may reformat numbers or dates when opening the file. I do not provide an import endpoint or infer verified market events from these exports.

## How I value recorded holdings

I multiply current shares by each ticker's latest stored raw USD close on or before the evaluation date. I keep exact decimal arithmetic for the calculation and show the date, age in calendar days, source, and import time for each usable quote. I can import a company snapshot in Prices and recheck it here; opening a portfolio does not call the external provider. I can still inspect an older stored snapshot after its 24-hour import cache expires, with its age shown explicitly.

I separate the priced holdings subtotal from cash plus all holdings. If any open holding lacks a usable quote, I withhold the complete portfolio value and aggregate unrealized P&L. I compare priced holdings with their remaining fee-inclusive cost basis; cash already includes recorded sales, fees, and dividends. I never substitute fictional closes for market portfolios. My example portfolio uses only invented DEMO closes.

I block a holding's mark when a recorded split is newer than its price date. I still need to verify that manually recorded events match the provider's share basis; this date check alone cannot establish that. I show an estimate of current recorded holdings at dated closes, not a synchronized live value, historical account value, or performance return. I do not include estimated selling costs or annualized returns.

## How I keep a research shortlist

I save one watchlist entry per catalog ticker, plus a clearly fictional DEMO entry. I can record my thesis, risks, research status, and next review date, then open that company's financials, valuation, or prices. I filter active research, reviews due on or before my browser's local date, or all entries including archived research. These dates are a research checklist; I do not send notifications or place trades.

I persist the shortlist in the shared database, separately from my browser-local research notes. I require the version and unique entry ID I opened when saving or deleting an entry, and return a conflict if another session changed it. I use a new entry ID when a removed company is added again, so an old editor cannot overwrite the replacement. I keep the draft after a failed save and explicitly reload to replace it with saved research. I still need accounts and private lists before using this as a personal multi-user research service.

## How I inspect portfolio concentration

I calculate company and sector weights from the same dated holdings valuations, using cash plus all holdings as the denominator. I rank companies and sectors by snapshot value, show my cash weight, and add the three largest company weights together. I show cash in both breakdowns but keep it outside the company and sector rankings. I use the catalog's fixed sector labels, with a separate fictional sector for DEMO.

I withhold every weight and largest-exposure summary if any holding lacks a usable close or total portfolio value is zero. I also withhold a sector's value if any of its holdings is unpriced. I retain available company values for inspection without treating their subset as the whole portfolio. I keep quote evidence in the valuation table, round displayed percentages, and do not claim that this concentration view measures volatility, correlation, or investment suitability.

## How I compare saved valuation cases

I select two to four saved scenarios for one company and choose a comparison baseline. I inspect all seven assumptions, highlight inputs that differ from the baseline, and compare enterprise value, equity value, per-share estimates, and terminal contribution. I keep the open calculator unchanged while comparing cases.

I show absolute per-share differences for matching model versions and calculate relative differences only when the baseline estimate is positive. I do not infer probabilities or label a saved case as a market forecast. I show each case's saved date and model version, and suppress deltas across different model versions. I can download the selected cases and baseline as a CSV with decimal-fraction rates; I protect text fields against spreadsheet formula interpretation. These saved assumptions are not verified historical market inputs.

## How I stress my practice holdings

I can apply a hypothetical price change from -100% to +100%, with optional overrides for sectors I hold. I replace the default with each override, including zero, and keep cash and share counts fixed. I calculate each holding's stressed value from its dated raw daily close, then compare the total with the cash-inclusive baseline.

I reload the ledger and stored snapshots for each run without importing prices or writing trades. I show the actual baseline dates, sources, import times, and price coverage used for the calculation. If any holding is unpriced, I retain the priced subtotal but withhold complete totals and changes. I leave the relative change unavailable for a zero baseline. These are user-entered price assumptions, not forecasts or historical event replays; I do not model correlations, taxes, trading costs, liquidity, or currency changes.

## How I keep stress scenarios

I can name and save a stress scenario in the database, then review its original cash, share counts, holding values, quote evidence, assumptions, and stressed results. I recalculate on the server when saving, so the saved baseline may differ from an earlier preview. Every save gets its own ID, timestamp, and `price-shock-v1` model version; later trades and price imports do not rewrite earlier snapshots. I can also save incomplete coverage without inventing missing values.

I can load a saved scenario's assumptions and run them on my current holdings. I retain overrides only for sectors I still hold and show which overrides I omitted. I keep saved results clearly labeled as historical snapshots, with a separate current result after rerunning. I can delete individual scenarios. This remains a shared workspace without accounts, and anyone with app access can read or delete these records.

## How I export stress research

I can download any saved stress scenario as `portfolio-stress-scenario.csv`. I export the original snapshot rather than recalculating against later holdings or prices. I use one row per assumption or metric, with record types for assumptions, portfolio totals, holding results, and methodology. Each row includes the saved scenario ID, portfolio ID, name, saved and evaluated timestamps, model version, data mode, currency, simulation flags, and price coverage. Holding rows repeat the saved shares, raw close, price date and age, source, source URL, import time, and any price error.

I keep exact decimal money and share values and express rates as decimal fractions, so `-0.20` means a 20% price drop. I leave unavailable values blank, retain priced subtotals without presenting them as complete totals, and escape formula-like text in names and evidence. I include the hypothetical model's limitations in the report so a spreadsheet reader can see how I calculated it.

## How I compare stress scenarios

I can select two to four saved stress scenarios for one portfolio and choose a reference case. I compare their defaults and sector overrides, cash, complete baseline totals, stressed totals, changes against each case's own baseline, coverage, model version, and holding-level price evidence. I keep each case's original saved values visible.

I show a stressed-value difference versus the reference only when both cases have complete coverage, the supported `price-shock-v1` model, and identical saved cash, shares, cost basis, sector labels, closes, price dates, source evidence, and baseline values. I ignore evaluation timestamps and holding order when checking this match. I withhold differences for changed holdings, changed price evidence, missing prices, unsupported versions, or numeric overflow; I do not interpret these differences as investment returns. I can remove selected cases or delete a saved case, and the reference falls back to a remaining selection. Comparing does not import prices, recalculate saved snapshots, or change my ledger.

## How I put saved valuations beside prices

I can compare my saved FCFF value per share with the company's latest stored raw USD close. I show the quote's date, calendar-day age, source, import time, and the saved model's timestamp and share count. I read local price snapshots, including explicitly dated expired imports, without spending another provider request. My DEMO workspace uses invented closes; I never substitute them for a catalog company with missing market prices.

I leave differences unavailable until I confirm that every saved model's share count and the quote use the same share basis. I clear that confirmation when I recheck prices, change the saved cases, or receive changed quote evidence while confirming. This is my acknowledgment, not verification of splits, dilution, or corporate actions by the app. I calculate `(modeled value per share - close) / close`, retain negative model values, and withhold comparisons for unsupported versions, missing or invalid quotes, and mismatched data modes. I treat this as context for my assumptions, not a target price, expected return, trading signal, or point-in-time backtest. Later imports can change this view without rewriting saved models.

## How I plan my research reviews

I use the watchlist review queue to see active research that is overdue, due today, due in the next seven calendar days, or missing a review date. I exclude archived entries from these counts, and the totals describe saved research rather than the current search subset. I can click a count to filter the list, search saved tickers, companies, sectors, theses, or risks, and isolate entries with an empty thesis or risks field. I use missing notes as a completeness prompt, not a judgment of research quality.

I order active entries by review date, with overdue reviews first, undated entries after dated entries, and archived entries last. I break ties by ticker. I compare calendar dates instead of elapsed hours, use the browser's local day, and refresh the day on a timer and when the view regains focus or visibility. I leave unsaved drafts unchanged when filtering or searching. If a reload fails, I withhold the queue and counts until saved entries load successfully. This is an on-screen planning queue, not a scheduled reminder, notification service, market alert, or trading signal.

## How I take my watchlist research into a spreadsheet

I can download all saved watchlist entries through `GET /api/watchlist/export.csv`, including archived research. I export the latest notes read from storage at download time, sorted by ticker, regardless of my browser's search or filters. I leave my unsaved draft out of the file and keep it open unchanged. If another session has saved newer notes, the download can differ from the list I last loaded.

I include each entry's ID, ticker, current catalog name and sector, instrument mode, research status, thesis, risks, review date, version, original creation time, update time, and a shared UTC export timestamp. I label the notes as user-entered research and DEMO as an example instrument. I leave missing review dates blank and export dates as saved, without adding a browser-dependent overdue classification. I escape commas, quotes, line breaks, and formula-like text for spreadsheet use. My export does not fetch financial filings or prices, validate a thesis, or change saved records. I show a download error if the service fails instead of saving an error response as research.

## How I review a company in one place

I open Research summary for the selected company to see its saved watchlist thesis and risks, latest supported financial facts, saved valuation cases, and latest stored raw USD close. I show dates, sources, instrument mode, model versions, and modeled share counts alongside the evidence. I include archived theses with an explicit archived label and keep missing notes, prices, models, or facts unavailable rather than substituting another company's data. I can open the corresponding Watchlist, Financials, Valuation, or Prices view directly from each section.

I load watchlist research and stored valuation/price evidence independently, so a failed section does not hide the others. Reload saved research clears the prior saved evidence and reads storage again; it does not import prices or refresh the financial report already loaded by the company workspace. I exclude browser-only notes and unsaved drafts. I keep each metric's own latest available period and filing date and distinguish invented DEMO figures from market instruments and SEC facts. I treat the view as evidence gathered at different times, not an atomic snapshot or a point-in-time backtest. I show saved modeled values without calculating an upside figure or inferring a recommendation; I use Valuation to inspect assumptions and acknowledge share-basis comparability before a price comparison.

## How I print my company research

I use Print research summary once its requests have finished to open my browser's print dialog. I can choose Save as PDF if the browser offers it. I print the evidence already displayed without making provider requests, refreshing financial facts, or saving new records. I retain unavailable sections and empty states rather than presenting the report as complete.

I include the company name, ticker, sector, instrument mode, and a UTC preparation timestamp. I use a light print layout with expanded tables, repeating table headings, wrapping notes, and full source URLs. I keep navigation and editing controls out of the printed report, while retaining source dates, archived labels, missing-data messages, modeled share counts, and negative valuations. I update the preparation time when printing starts, including through the browser's Print command; this time describes report preparation, not when the underlying evidence was gathered. I rely on the browser to choose the final PDF filename, page headers, footers, and destination.

## How I track evidence I still need to review

I keep five manual research checks with each watchlist entry: filings, cash flow quality, debt and liquidity, valuation share basis, and thesis risks. I edit them in the watchlist draft and save them with the thesis under the same entry ID and version checks. I keep unsaved marks when a save fails or I filter the list; reloading replaces the draft with saved research. I can filter active entries with checks still open, and I show saved marks in the company summary and its print view.

I treat these marks as my own acknowledgments, not verified evidence, a quality score, or an investment recommendation. I revisit them after new filings or changed assumptions; they do not expire or reset automatically. I do not use a saved share-basis check to confirm a valuation price comparison. I append five `user_reviewed_*` boolean columns to the watchlist CSV: true means I marked the item, and false means it is not marked. I preserve existing notes when upgrading the database and start their checks empty. I also preserve saved marks when an older client omits `checks` or sends null; an explicit empty list clears them. I reject unknown, duplicate, and null checklist items before saving.

## How I link directly to company research

I can copy a company research link from its summary, for example `/#research?company=AAPL&view=summary`. I put only the ticker and view in the link, and I remove existing query parameters and URL credentials when generating it. I keep the selected company and tab in browser history so reloading, Back, and Forward reopen the matching view. I offer a selectable link field if clipboard copying is unavailable.

I validate linked market tickers against the loaded catalog before requesting their evidence. If the catalog is unavailable, I wait and let myself retry or explicitly open the example workspace. I show a notice for invalid views, duplicate routing parameters, and unsupported companies instead of silently presenting example data as the linked company. I preserve the application path and use a URL fragment, so opening the link does not require an extra server route.

I share a route to the latest evidence on the same running app instance, not a frozen report or an access grant. I do not include theses, drafts, notes, portfolios, or provider keys in the generated URL. I use the existing saved-data and provider behavior when a view opens; the link does not make unavailable evidence available. I need a reachable hosted instance for another person to open the same workspace, since a localhost link works only on my own computer. I use the printed report when I want to share evidence fixed at the time I prepared it.


## How I revisit changes to my research

I load Research revision history from the watchlist editor for the selected ticker. I keep each successful save as a separate snapshot of the thesis, risks, status, review date, checklist, entry ID, version, and original save timestamps. I record removal events too; removing an entry from the active watchlist retains its shared historical notes. Recreating it starts a new entry ID and version sequence while its earlier research remains readable. I load 20 revisions at a time and can request older pages without changing my open draft.

I write the snapshot and active record in one transaction, so a history failure rolls back the edit or removal. I reject stale versions without adding a revision and lock the saved row before capturing a change. For research saved before this feature, I capture the surviving record as a legacy baseline on its next edit or removal, with a new capture timestamp and its original save date. I cannot reconstruct earlier edits. I exclude unsaved drafts and browser-only notes, and I do not claim a verified editor identity in this shared app without accounts. This is a history of research notes, not point-in-time financial evidence or a tamper-proof audit log.

I can select any two loaded revision records to compare exact saved values for the thesis, risks, research status, review date, and five manual checklist marks. I highlight changed fields and can hide unchanged fields. I keep event labels, record sequence, entry IDs, and versions alongside the comparison so a removal with unchanged notes or a recreated version 1 is not mistaken for a thesis edit. I can compare records from different history pages; reloading history clears the selection, and viewing a comparison leaves my current draft untouched.

I can prepare any loaded historical record as an editor draft. I preview its saved fields and explicitly replace the editor draft before anything changes. I keep the editor's original entry ID and expected version, so copying an older record does not bypass conflict checks or silently rebase a stale draft. I revisit old archived status, review dates, and manual marks before saving. Saving writes a new revision; it never modifies the source snapshot. If no active entry exists, saving creates a new entry ID. Canceling the preview leaves my draft untouched.


I can download all recorded research revisions for the editor's company as CSV, regardless of the history pages or comparison records I have loaded. I include saved snapshots, removals, and legacy baselines in recorded order, oldest first. I keep entry IDs, versions, capture times, original save times, exported time, and manual checklist marks in separate columns. I label company names and sectors as current catalog metadata, exclude drafts, and leave my open editor unchanged. I escape commas, quotes, line breaks, and formula-like text using the same CSV rules as my other exports. The file contains only recorded history; it cannot reconstruct earlier legacy edits or verify an editor's identity.

I keep the active research section visible in the scrolling mobile navigation. I can use the first keyboard link to skip straight to the research content without changing my saved research URL, and focused controls have a copper outline.

I show horizontal scroll controls only when financial or summary evidence tables are wider than their viewport. I can move through the columns with the arrow buttons, touch scrolling, or the keyboard-focused table region; the indicator tells me when I reach the last columns. I keep these controls out of printed summaries.

I show how many catalog companies match my search and sector, and I can clear both filters together. I close the picker when I click outside it or press Escape. On small phones I use one column so full company names are easier to read.

I can download the research note currently on screen as a UTF-8 text file, with the company, export time, and saved-or-draft state. I preserve the note text and leave browser storage and draft warnings unchanged. This gives me a portable copy even if saving in the browser fails; it does not include financial evidence or create a cloud backup.

I can also download a versioned JSON backup of that note and preview it in another browser on the same company. I restore only after choosing Restore into editor, which replaces my current draft but leaves the saved browser note untouched until I save. I reject invalid, oversized, or different-company files, support up to 100,000 text characters, and keep empty notes restorable. I treat the file’s date, company, and saved/draft label as unverified metadata. This transfer covers one browser note at a time; database backups cover different shared records.

I compare the selected financial metric’s latest reported amount with a unique prior period ending 300–400 days earlier. I show the periods, dollar change, and percentage change from a positive prior value. I withhold percentages for zero or negative baselines while retaining valid dollar changes. For annual flows I require known starts, 300–400 days per window, and at most a seven-day length difference; for cash I compare dated balances instead. I do not bridge a missing year, annualize, adjust for acquisitions or accounting changes, or treat an increase as a performance rating or stock return.

I download those latest-year comparisons for all loaded metrics as an annual changes CSV, regardless of which metric is selected on screen. I use the same comparison rules and include raw numeric changes, percentage units, separate availability flags and reasons, both reported input records with filing metadata, the report’s source and data mode, and an export timestamp. I leave unavailable results blank, retain valid zeros and negative dollar changes as numbers, protect formula-like text, and keep fictional examples labeled. I export only the loaded evidence without another provider request; this is not the full financial-history CSV or a frozen SEC snapshot.

I review the lowest and highest valid modeled values in the DCF sensitivity grid alongside each cell’s WACC and terminal growth. I count unavailable cells, preserve negative estimates, and show the first cell in grid order when values tie. This is a range across the tested inputs, not a probability distribution or confidence interval. I can download every grid cell as CSV with the fixed inputs, decimal rates, base-case mark, result or unavailable reason, and calculation/export times. I reuse the calculated grid without another request, label fictional inputs, and remove the view when model inputs change. Loading a saved case calculates a fresh FCFF sensitivity grid rather than reconstructing its historical grid.

I review a valuation breakdown from discounted forecast and terminal cash flows through enterprise value, net debt, equity value, and modeled shares to value per share. I show negative net debt explicitly as net cash added to equity. I keep these amounts tied to the calculated or loaded case and clear them when I edit inputs. The breakdown, forecast, and sensitivity tables use the same mobile scroll controls as my other evidence tables.

I can download a valuation snapshot as JSON with the original assumptions, forecast, result, model version, units, and export time. I distinguish a new session calculation from a loaded saved case, retaining its ID, name, and save time without inventing a historical calculation time. I clear the export when inputs change. This is a portable review file, not an import feature, market quote, or verified financial evidence.

I chart projected unlevered cash flow against its discounted present value on the same zero-based USD scale. I show terminal value separately as a share of discounted enterprise value, before net debt. The chart uses solid and dashed lines as well as colors, and the evidence table retains exact amounts. I redraw both visuals for calculated or loaded cases and remove them when inputs change.

I can export the six company fundamentals measures as CSV with unrounded values, explicit USD or decimal-ratio units, calculation descriptions, and each underlying input’s period, filing date, tag, and source link. I use the same period matching and missing-data rules as the comparison screen. I export only loaded reports, include load failures, retain negative cash flows, and leave unavailable ratios blank. I protect text fields against spreadsheet formula interpretation.

I retain editable valuation inputs separately for each company while I move between screens in the open app. I restore inputs without restoring a stale result, so I recalculate before reviewing or saving it. I can reset only the current company’s inputs, returning DEMO to its fictional defaults. These session inputs disappear on refresh or close; saved database scenarios remain the durable option.

I search saved valuation cases by name, ID, or model version, sort by save date or name, and isolate my selected cases. I keep comparison selections while filtering and show the visible and selected counts. Filters affect the case list only; price evidence and selected comparisons continue to use the saved cases below. Resetting filters leaves selections intact.

I export either all saved valuation cases or just the cases shown by my filters, in the current sort order. Each CSV keeps case IDs, names, model versions, save and export times, assumptions, and valuation outputs together. I label USD columns and decimal rates, preserve negative numeric values, protect text against spreadsheet formula interpretation, and leave nonfinite numbers blank. Exporting leaves my selections and open model unchanged.

I review annual revenue growth, net income margin, operating cash flow margin, and cash after capex in the financials view. I reuse the comparison period-matching rules for each revenue period and expose the underlying values, dates, tags, and filing links in expandable evidence. I leave unavailable ratios blank and keep cash after capex distinct from valuation FCFF.

I switch the annual performance chart between revenue growth, net income margin, and operating cash flow margin on a zero-based percentage scale. I leave gaps for missing inputs and space annual observations evenly, with exact dates in the table. I can download six fundamentals measures for every period, including revenue and cash-after-capex/revenue, using the same source-backed CSV format as peer comparisons.

I keep the measure column visible when scrolling wide peer fundamentals, saved valuation, and saved research comparisons. I shorten arrow-button steps to account for that fixed column, show a small explanation when the table overflows, and use explicit row and column headers. I leave print tables in their normal layout.

I inspect a measure-availability checklist in peer comparisons and can show only unavailable measures. I distinguish missing supported inputs, fiscal-period mismatches, nonpositive denominators, and numeric limits while retaining negative income and cash flows as valid values. The peer and annual-performance CSVs include the same availability status and reason. These checks describe supported evidence, not investment quality or verified accounting accuracy.

I choose an inclusive first and last fiscal period for annual performance. I apply the same window to the chart, table, and CSV while retaining earlier loaded evidence for growth calculations. I reject reversed windows, disable their export, and can restore all periods. Filtered filenames record the selected period boundaries.

I summarize endpoint changes across the selected annual window: revenue change in percent, margin changes in percentage points, and cash after capex change in USD. I show the starting and ending values and dates, require two periods, and retain unavailable endpoints rather than substituting other years. These changes are not annualized and are not stock returns.

I compare one fundamentals measure across peers using a shared zero-based scale. I preserve the selected company order and negative values, expose unavailable-input reasons, and show each company’s annual fiscal period. I switch among the six existing measures using the same calculations as the evidence table and exports. This view is not an investment ranking.

I include a nondefault peer-chart measure in real-company comparison links, alongside the selected tickers. I restore it on reload and browser history changes and keep it when adding or replacing peers. Links without a measure still open net income margin. I validate measure names and reject duplicate or misplaced measure parameters; links contain no financial snapshots or research text.

I save named company-comparison setups in the shared database with two to four distinct real catalog tickers, their order, and a chart measure. I can refresh, reopen, or delete these setups across sessions. Reopening requests current reports; no financial figures or results are stored in a setup. I reject fictional or unknown tickers and unsupported measures. Anyone with workspace access can view or delete setups until accounts and private workspaces are added.

I search saved company-comparison setups by name, company, ticker, or chart measure. I export all loaded setups to CSV even when search hides some records, keeping peer order, saved dates, model versions, compatibility, and list-update/export times. I include no financial figures; opening a setup requests current reports.

I review peer fiscal periods before interpreting differences in fundamentals. I show the latest revenue windows, inclusive calendar-day lengths, period-end spread, and lag relative to the newest loaded peer period. I flag incomplete or invalid dates and differing catalog sectors, preserve filing evidence, and export the review with load failures. I do not calendarize or annualize figures, and matching dates do not establish accounting or business comparability.

I download a company research-evidence JSON file from the summary after its reads finish. I capture loaded annual history, saved watchlist text, dated close evidence, and saved valuation summaries with their source dates, explicit unavailable/not-saved states, an export timestamp, and a version. I do not fetch new data or export browser-only notes, unsaved drafts, full valuation assumptions, or value-versus-close gaps. I keep sections’ different dates visible and review saved text before sharing the file.

I compare earnings with operating cash flow across the selected annual performance window. I show matched-period net income, operating cash flow, their dollar difference, and operating cash flow divided by positive net income. I keep negative cash flow, leave loss/zero-income ratios unavailable, and export both inputs with dates, accounting tags, filing sources, and missing-value reasons. I treat these as descriptive measures, not an earnings-quality score, working-capital reconciliation, or free cash flow.

I load valuation, peer comparison, price analysis, portfolios, watchlist, and research-summary code when I open those sections. I keep the main navigation available during loading and show a reload action if a section cannot open. I retain the existing API errors and draft-exit warning.

I recorded my final desktop/mobile review in [my workflow review](docs/workflow-review.md). I check all eight sections at 1440, 390, and 320 pixels and use labeled, keyboard-focusable scroll controls for the core daily-price and portfolio evidence tables.

I back up the Compose/PostgreSQL database with a custom-format archive and restore it into a separate empty database. I verify saved research/revisions, valuation cases, and simulated portfolios after restoration in CI. I document the non-overwrite guards and limits in [my backup/restore route](docs/backup-restore.md).

I open Data connections to see whether SEC filings and market-price imports are configured independently. I read configuration-presence flags only when I open or refresh the panel; I do not contact providers or expose keys/contact details. I distinguish configured imports from verified access or company coverage, and I keep stored evidence and key-free examples available even when setup is missing.

I reload saved valuation scenarios without losing my open model, scenario-name draft, or list filters. I distinguish a failed read from a genuinely empty list, pause saving until the list loads, and hide stale saved-case exports and comparisons during recovery. After a successful reload I retain comparison selections that still exist and remove selections deleted from the shared workspace.

I use keyboard and arrow-button scrolling for the saved-valuation versus stored-close evidence table on small screens. I reject a comparison response if its ticker, fictional/market mode, or share-basis confirmation differs from the request. I keep the mismatched evidence hidden and can recheck to recover; matching evidence still requires my own share-basis review before gaps appear.

I check that a loaded portfolio ledger matches the selected portfolio ID and instrument mode, and that its price evidence matches that same portfolio and mode. I hide mismatched responses and can reload or recheck to recover. I also bind price evidence to the ledger read that requested it, so changing portfolios or updating the ledger clears earlier valuation figures before the next read completes.

I can show only changed assumption rows when comparing saved valuation cases. I keep estimates and model-version warnings visible, show how many of the seven input fields differ, and distinguish identical inputs from identical results. I retain every input in the comparison CSV regardless of this screen filter, use the selected baseline for deltas, and show a recoverable message if preparing the download fails.
