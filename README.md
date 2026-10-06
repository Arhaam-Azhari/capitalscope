# CapitalScope

I'm building a workspace for company research, valuation, and practice portfolios. I started with the research API and a discounted cash flow calculator. The project is in its first backend milestone; the dashboard and portfolio tools are still to come.

## What works in this milestone

- A catalog of 50 U.S. public companies across several sectors.
- An SEC client that resolves ticker symbols to CIKs and retrieves company facts.
- Annual revenue, net income, operating cash flow, capital expenditure, and cash figures when supported standard tags exist.
- Source links, filing dates, and accounting tags attached to each reported value.
- A DCF endpoint with explicit assumptions, yearly projections, and terminal-value contribution.

I selected the top 50 American companies from the CompaniesMarketCap ranking observed on October 6, 2026, using one ticker per company. This is a fixed snapshot; it does not update itself when market caps change.

Catalog source: https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/

The catalog is a starting universe, not a claim that all 50 companies have been verified against the live SEC API. Missing data stays missing rather than becoming zero.

## Run the backend

I use Java 17 and Maven 3.9 or newer.

```bash
export SEC_USER_AGENT='CapitalScope your-contact-email@example.com'
cd backend
mvn spring-boot:run
```

Replace the example email with a real contact address. The SEC requests an identifying User-Agent for automated access. The company catalog and valuation endpoint work without this setting; the financial-data endpoint needs it.

```bash
curl http://localhost:8080/api/companies
curl http://localhost:8080/api/companies/AAPL/financials
curl -X POST http://localhost:8080/api/valuations/dcf \
  -H 'Content-Type: application/json' \
  -d '{"baseFreeCashFlow":100000000,"growthRate":0.05,"discountRate":0.10,"terminalGrowthRate":0.02,"years":5,"netDebt":200000000,"sharesOutstanding":50000000}'
```

Those valuation inputs are invented examples, not Apple's figures. Rates use decimals: `0.10` means 10%. Cash flow, net debt, and share count use full units, not millions.

## How I treat the valuation

The model discounts **unlevered free cash flow to the firm** using a discount rate representing WACC. It subtracts net debt from enterprise value to calculate equity value, then divides by shares outstanding. Negative net debt represents net cash.

The SEC cash-flow figures are research inputs. I don't automatically treat operating cash flow minus capex as unlevered free cash flow; that needs further adjustments. For now, I enter the valuation inputs separately.

Banks, insurers, and diversified financial groups need sector-specific valuation methods. Their inclusion in the research catalog does not make this general FCFF model suitable for them. Newly listed companies may also have no annual 10-K facts yet.

This first model supports positive starting cash flow, a constant forecast growth rate, and a Gordon-growth terminal value. It does not yet cover loss-making companies, changing share counts, excess assets, or every claim on equity. A negative equity estimate is returned rather than silently clamped to zero.

## Data handling

I cache SEC responses in memory for six hours and space outbound requests at least one second apart. The cache resets when the app restarts. This limiter applies to one running backend; shared rate limiting will be needed before running multiple instances.

I keep annual duration facts and choose the latest-filed value for each period within the preferred supported tag. Earlier years may therefore contain restatements. This is **not** point-in-time data for backtesting. Cash balance dates can also include comparative dates from annual filings. Different fiscal calendars need attention when comparing companies.

Custom XBRL tags and non-USD values aren't supported yet. Each missing metric returns an empty list. I haven't added persistent storage, accounts, stock-price data, or a frontend yet.

SEC API reference: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

## Checks

```bash
cd backend
mvn verify
```

For just the valuation regression checks, Java is enough:

```bash
bash scripts/check-valuation.sh
```

The valuation checks cover a constant-cash-flow perpetuity, net debt and net cash, discount-rate changes, invalid rates, invalid shares, and numeric overflow. The Maven suite also checks annual fact selection using synthetic data. Tests never call the live SEC API.

## Next steps

1. Run the complete backend suite and verify real filings for the initial company universe.
2. Store imports and source metadata in PostgreSQL.
3. Build the company research and comparison screens.
4. Save valuation assumptions and investment notes.
5. Add historical prices, simulated holdings, benchmarks, and risk analysis.
