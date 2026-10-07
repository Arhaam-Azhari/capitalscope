# CapitalScope

I'm building a workspace for company research, valuation, and practice portfolios. I can browse companies, inspect annual figures, save valuation scenarios, and keep research notes. SEC imports and valuation versions now live in a database.

I gave this workspace a midnight-blue and violet design, with top navigation and a searchable company picker. I can read the annual chart beside its source table on desktop; the layout stacks on smaller screens.

![My company research workspace with explicitly labeled example figures](docs/research-dashboard.png)

## Run the app

With Docker installed, copy `.env.example` to `.env` and set `DATABASE_PASSWORD` to a password for the local database:

```bash
docker compose up --build
```

Open http://localhost:8080. The app starts in a clearly labeled example workspace with invented figures. The company catalog and calculator work without API keys.

For real SEC imports, copy `.env.example` to `.env`, set `SEC_USER_AGENT` to an app name and a real contact email, and restart. I don't include contact information or credentials in the repository. Upstream failures are reported rather than replaced with example numbers.

## What I can do

- Inspect daily price history with source, retrieval date, and raw-price caveats.
- Record simulated splits and cash dividends in the same ordered history as trades.
- Create practice portfolios, record manual simulated buys/sells and fees, and inspect cash, holdings, and realized P&L.
- Download financial facts and ordered portfolio events as CSV files.
- Search 50 companies by name or ticker and filter by sector.
- Request annual revenue, net income, operating cash flow, capex, and cash balances from SEC EDGAR.
- Inspect charts, exact values, filing dates, source links, and accounting tags.
- Inspect a 5 × 5 sensitivity table across discount rates and terminal growth assumptions.
- Enter assumptions in a DCF model and inspect projections, estimated value, and terminal contribution.
- Compare two to four companies with matching-period margins, revenue growth, cash after capex, and filing evidence.
- Explore a separate fictional peer set without configuring SEC access.
- Save, reload, and delete named valuation scenarios for each company.
- Save research notes separately for each company in the current browser.

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
| `GET /api/companies/{ticker}/prices` | Cached daily raw prices from Alpha Vantage |
| `GET /api/examples/prices` | Invented price series for the fictional company |
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
| `GET /api/companies/{ticker}/scenarios` | Saved versions for a company (`DEMO` is separate) |
| `POST /api/companies/{ticker}/scenarios` | Save `{name, assumptions}`; results calculated on the server |
| `DELETE /api/companies/{ticker}/scenarios/{id}` | Delete one saved version |

Example valuation request:

```bash
curl -X POST http://localhost:8080/api/valuations/dcf \
  -H 'Content-Type: application/json' \
  -d '{"baseFreeCashFlow":100000000,"growthRate":0.05,"discountRate":0.10,"terminalGrowthRate":0.02,"years":5,"netDebt":200000000,"sharesOutstanding":50000000}'
```

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

This is a single shared research workspace without accounts. Saved scenarios are visible to everyone who can reach the app. Compose binds the app to localhost. I still need user accounts and private workspaces. Daily price history and simulated portfolios are available; portfolio returns and corporate-action handling are not.

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

GitHub Actions runs backend/package checks and frontend/browser checks on pushes and pull requests. Docker packaging is provided but has not yet been tested in CI.

## Next steps

1. Verify live imports and improve accounting-tag coverage.
2. Add accounts and move notes into private research workspaces.
3. Improve peer selection and expand sector-specific models.
4. Add verified price adjustments, portfolio valuation, and trade corrections.
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

I lock each portfolio row while recording a fill and require a request UUID. Retrying the same fill with the same UUID does not create another trade; reusing it with changed inputs fails. I keep the recorded fills append-only. Corrections, external deposits, provider-verified corporate actions, mark-to-market values, and portfolio return calculations are still to come. Everyone who can access this shared app can see portfolios and record trades.

## How I record simulated splits and dividends

I replay trades and manual company events in one database sequence, including trades saved before this feature. I record new events at the current time and apply them to the position held then. I do not backdate entitlements or treat these inputs as verified market events.

For a split, I enter integer new-share and old-share terms, such as 2:1 or 1:10. I change the share count while preserving total cost basis, then recalculate average cost. I reject results requiring more than six decimals rather than invent cash in lieu. For a dividend, I enter a USD amount per share, credit current shares times that amount to cash, and show dividend income separately from realized trading P&L. I do not model withholding, reinvestment, return of capital, or ex-date eligibility.

I use the same row lock and request UUID checks for trades and actions. I reject a UUID reused across different event types or terms. These practice events do not adjust the Alpha Vantage price series, so I still need verified adjustments before reporting portfolio returns.

## How I export my research

I can download annual facts with their original decimal values, units, period dates, filing evidence, accounting tags, data mode, and retrieval timestamp. I keep missing metrics as blank rows rather than writing zeros. I also export portfolio events in recorded order, starting with the initial cash deposit, and mark every row as simulated. I include manual fill prices, fees, split ratios, and dividends so I can inspect the history in a spreadsheet.

I export UTF-8 CSV, escape commas, quotes, and line breaks, and protect user-entered text that could be interpreted as a spreadsheet formula. I preserve decimal numbers in the CSV text; spreadsheet applications may reformat numbers or dates when opening the file. I do not provide an import endpoint or infer verified market events from these exports.
