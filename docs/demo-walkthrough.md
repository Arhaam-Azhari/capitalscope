# My CapitalScope demo

I use this route when I want to show the project in about five minutes. I start with the fictional workspace so the core demo works without API credentials, then show market data separately if I have configured it.

## I start the app

I use the jar path with Java 17, Maven 3.9+, and Node.js 22:

```bash
bash scripts/build.sh
java -jar backend/target/capitalscope-0.1.0.jar
```

I open http://localhost:8080. I need no live credentials for the fictional workspace. I keep `./data` if I want to retain saved work between launches. I use the jar for my local demo and verify Docker/Compose in CI; [my release notes](portfolio-release.md) describe the verified routes and remaining live-provider checks.

## My five-minute presentation route

| Time | What I show | What I explain |
| --- | --- | --- |
| 0:00–0:45 | I open the fictional Financials workspace and its exact annual evidence. | I keep reported facts, source dates, and missing values visible. These demo figures are invented. |
| 0:45–2:00 | I calculate the $90 valuation below and inspect its sensitivity range. I select a sensitivity cell, then explicitly recalculate. | I can trace an estimate back to my assumptions. Changing inputs clears the earlier result; a model estimate is not a market forecast. |
| 2:00–2:45 | I open prepared research notes, a saved thesis, and revision history. | I separate browser-only drafts from shared saved records and retain conflicts rather than silently replacing newer work. |
| 2:45–4:15 | I compare prepared downside/upside stress snapshots, filter their assumptions, and download the selected comparison CSV. | I preserve each saved baseline, keep cash fixed, and export complete evidence even when screen filters hide rows. |
| 4:15–5:00 | I point to the repository architecture and passing PR checks. | I connect React/TypeScript, Java APIs, JDBC/Flyway persistence, and PostgreSQL/container checks. I explain the shared-workspace and live-provider limits. |

I prepare the valuation, thesis, and practice portfolio before presenting. I use the detailed flows below for questions about prices, allocations, data sources, or recovery. I keep the main route focused on evidence, assumptions, persistence, and a reproducible export.

## I inspect financial evidence

I open **Financials** and switch between revenue, net income, operating cash flow, capex, and cash. I show the chart beside the exact annual table. I point out the example label before discussing any number.

I open **Compare companies** to inspect the fictional peer set. I compare matching-period ratios and the available evidence rather than treating unmatched fiscal periods as directly comparable.

## I change a valuation assumption

I open **Valuation** and enter this small calculation:

| Input | My value |
| --- | --- |
| Starting unlevered cash flow | 100 |
| Annual growth | 0% |
| Discount rate / WACC | 10% |
| Terminal growth | 0% |
| Net debt | 100 |
| Shares outstanding | 10 |

I keep the five-year projection horizon and click **Calculate valuation**. I expect a modeled value of **$90 per share** with these inputs. This case is also covered by the packaged integration test.

I inspect the sensitivity range and table, save a named case, and reload it. I can select a valid sensitivity cell to copy its WACC and terminal-growth assumptions into the form; I explicitly calculate again before saving a new result. I show that changing inputs clears results that belong to the previous calculation. I explain that the calculator reflects my assumptions; it does not produce an analyst forecast.

I keep a [captured valuation screen](valuation-review.png) for a quick visual reference.

## I build a practice portfolio

I open **Portfolios**, create a fictional DEMO portfolio with **$1,000** initial cash, and record a simulated buy of **10 shares at $20**, with **$0 fee**. I inspect cash, recorded fills, holdings, and stored-price valuation.

With the current invented close of $21.60, I expect $800 cash, $216 in marked holdings, and a $1,016 total. I distinguish the recorded fill price from the dated mark. I use the values actually shown if I change the example fixture.

I enter target allocations of **40% Cash / 60% DEMO**, calculate the dollar changes, and save that mix. I calculate and save **100% Cash / 0% DEMO** as a second proposal. I select both saved mixes to compare them at one current valuation.

I apply an explicit price shock, inspect each mix's own fixed cash reserve, and download the comparison evidence. I show that calculating or loading targets records no trades. I treat share estimates as optional and check their basis before using them.

## I compare saved price-shock cases

I use the $1,000 practice portfolio above, with 10 DEMO shares bought at $20 and no fee. At the invented $21.60 mark, I have $800 cash and $216 in holdings. I run **−20%** and save **My downside**, then run **+20%** and save **My upside**, without entering any trades between those saves.

I expect saved totals of **$972.80** and **$1,059.20**. With the downside as my reference, the upside differs by **$86.40**. I explain that both use the same saved holdings and price evidence. If I change holdings or price evidence before saving a later case, I expect reference differences to become unavailable rather than treating different baselines as comparable performance.

I select both cases, use **Show differing shock assumptions only**, and download **stress comparison CSV**. I show that the export retains unchanged assumptions, both saved baselines, original holding evidence, and the chosen reference. Missing differences stay blank with a reason. I can search the saved-case list or show selected cases without losing hidden comparison selections. Reloading preserves my filters and name draft while reconciling deleted cases.

I keep a [captured saved stress comparison](stress-comparison.png) for this part of the demo. These are hypothetical price shocks, not return forecasts, probabilities, or broker orders.

## I inspect price declines

I open **Prices** for Example Manufacturing, choose a date window, and click **Analyze price drawdown**. I inspect the maximum decline, the chart, recovered and unfinished episodes, and exact observation rows.

I download raw price history and an analysis CSV. I show that the raw history export contains the full loaded snapshot even when the analysis window is narrower. I distinguish provider retrieval, view-load, and export times. I reload stored prices to demonstrate that dependent calculations clear.

I call these raw-price declines, not total returns: splits and dividends are unadjusted, and the fictional dates do not follow an exchange calendar.

## I extend the demo with configured market data

I set `SEC_USER_AGENT` to an app name and a real contact address to enable SEC requests. I set `ALPHA_VANTAGE_API_KEY` to enable market-price imports, then restart the app. These services have separate configuration and can fail independently.

I choose a catalog company and inspect filing dates, accounting tags, and source links. I show missing data as missing. I do not substitute invented figures when an upstream request fails.

In **Prices**, I choose a second market company and load a comparison. I inspect exact shared dates, excluded observations, indexed closes, and interval changes with their calendar spacing. I save a named pair/window setup, reopen it, and calculate again. I explain that the setup stores inputs, not historical prices or results.

I cannot guarantee that every catalog company has usable filings or overlapping stored prices. If market access is unavailable, I show the explicit error and continue the fictional demo.

## I explain the engineering behind the flow

| Part I show | What I built |
| --- | --- |
| Company research | React and TypeScript views, API integration, dated evidence, and explicit missing-data states |
| Valuation | Java calculations, assumption validation, sensitivity analysis, and saved model cases |
| Practice portfolios | Ordered simulated events, transaction handling, cash and holding checks, and separate stored-price marks |
| Saved research and setups | JDBC persistence, Flyway migrations, shared-workspace records, and scoped mutations |
| Price comparisons | Exact date alignment, coverage diagnostics, cancellation of stale requests, and reproducible CSV evidence |
| Delivery | Feature PRs, focused local checks, frontend CI, PostgreSQL checks, and packaged integration tests |

I describe the app as a shared research and simulation workspace. I have not implemented private user accounts or broker execution. I keep financial facts separate from user assumptions and treat restated SEC history as unsuitable for point-in-time backtesting. I can explain these boundaries without claiming that the app is a trading platform.

## I recapture the demo screens

I build a fresh jar first with the launch instructions above. With the matching Playwright browser installed, I run:

```bash
npm run demo:capture --prefix frontend
```

I install the browser, if needed, from `frontend` with `npx playwright install --only-shell chromium`. On a minimal Linux host I use Playwright’s ordinary `--with-deps` installation; the GitHub Actions dependency script is intentionally CI-only.

I start the packaged app on an available local port with an isolated in-memory H2 database and both live providers disabled. I pass database and provider settings as launch arguments so ordinary Spring environment overrides cannot redirect the capture. I use actual app APIs and UI interactions, without stubbing financial responses. I check the $90 valuation, the $86.40 saved-case difference, mobile page width, and comparison download before finishing. I close the browser and server afterward.

I overwrite four documentation images: [desktop financials](research-dashboard.png), [mobile financials](research-dashboard-mobile.png), [valuation review](valuation-review.png), and [stress comparison](stress-comparison.png). I do not write to an existing local database or need provider credentials for this capture. These screenshots verify the fictional demo flow, not live SEC or market-data coverage.
