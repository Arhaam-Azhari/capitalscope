# My CapitalScope technical reference

I keep endpoint details, model limits, provider behavior, and storage choices here. I use the [README](../README.md) for launch and development commands and the [workflow guide](workflows.md) for user-facing behavior.

- [API](#api)
- [Model assumptions](#model-assumptions)
- [Data and storage](#data-and-storage)

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
