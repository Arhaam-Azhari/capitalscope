# CapitalScope

I built CapitalScope to connect SEC financial evidence, explicit valuation assumptions, saved research, and simulated portfolios in one finance workbench. I use React/TypeScript, Java/Spring Boot, API integrations, JDBC, Flyway, and PostgreSQL/H2.

I have finished the scoped portfolio release. I describe the verified launch path, test coverage, and provider limits and verified container checks in [my release notes](docs/portfolio-release.md). I keep accounts and broader product work separate from this release.

I gave CapitalScope a warm ivory and copper identity, with serif company titles, an editorial metric strip, and horizontal navigation. I checked it against my LedgerDesk UI so the projects have different colors, typography, and layouts. I keep tables readable and let wide evidence tables scroll on smaller screens.

![My company research workspace with explicitly labeled example figures](docs/research-dashboard.png)

I also keep a [mobile screenshot](docs/research-dashboard-mobile.png), a [valuation review](docs/valuation-review.png), and a [saved stress comparison](docs/stress-comparison.png), captured from the packaged app with labeled fictional data.

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

## My documentation

| I want to… | Where I go |
| --- | --- |
| Try the main workflows in about five minutes | [Demo walkthrough](docs/demo-walkthrough.md) |
| Inspect research behavior and export scope | [Workflow guide](docs/workflows.md) |
| Read API, model, and storage details | [Technical reference](docs/technical-reference.md) |
| Check verified release scope and remaining limits | [Portfolio release](docs/portfolio-release.md) |
| Review the fixed company catalog | [Company universe](docs/company-universe.md) |
| Verify container persistence or restore saved work | [Container checks](docs/container-check.md) and [backup/restore](docs/backup-restore.md) |

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

I list the endpoints and their purposes in [my API reference](docs/technical-reference.md#api).

## Model assumptions

I use an FCFF model with explicit user assumptions, WACC, net debt, and modeled shares. I document supported inputs and sector limits in [my model reference](docs/technical-reference.md#model-assumptions).

## Data and storage

I describe SEC selection rules, caching, browser notes, shared database records, and PostgreSQL/H2 setup in [my data and storage reference](docs/technical-reference.md#data-and-storage).

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
