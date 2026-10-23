# My CapitalScope demo

I use this route when I want to show the project in about five minutes. I start with the fictional workspace so the core demo works without API credentials, then show market data separately if I have configured it.

## I start the app

I use the jar path with Java 17, Maven 3.9+, and Node.js 22:

```bash
bash scripts/build.sh
java -jar backend/target/capitalscope-0.1.0.jar
```

I open http://localhost:8080. I need no live credentials for the fictional workspace. I keep `./data` if I want to retain saved work between launches. I use the jar for my local demo and verify Docker/Compose in CI; [my release notes](portfolio-release.md) describe the verified routes and remaining live-provider checks.

## My short presentation route

1. I show the example label, annual figures, and dated input evidence in Financials.
2. I open Valuation and calculate the $90-per-share case below, then change an assumption to clear the previous result.
3. I open the fictional peer comparison, switch the chart measure, and review the companies' fiscal periods.
4. I show a saved watchlist thesis and its research summary, then download research-evidence JSON or use Print. I explain that sections retain different source dates.
5. I open a prepared fictional practice portfolio and distinguish recorded fills, available cash, and dated holdings marks. I show Prices as a raw-price analysis view.

I prepare the saved thesis, valuation case, and example portfolio before presenting if I want to keep the live walkthrough to about five minutes. I use the detailed flows below for a longer discussion.

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

I inspect the sensitivity table, save a named case, reload it, and change an assumption. I show that changing inputs clears results that belong to the previous calculation. I explain that the calculator reflects my assumptions; it does not produce an analyst forecast.

## I build a practice portfolio

I open **Portfolios**, create a fictional DEMO portfolio with **$1,000** initial cash, and record a simulated buy of **10 shares at $20**, with **$0 fee**. I inspect cash, recorded fills, holdings, and stored-price valuation.

With the current invented close of $21.60, I expect $800 cash, $216 in marked holdings, and a $1,016 total. I distinguish the recorded fill price from the dated mark. I use the values actually shown if I change the example fixture.

I enter target allocations of **40% Cash / 60% DEMO**, calculate the dollar changes, and save that mix. I calculate and save **100% Cash / 0% DEMO** as a second proposal. I select both saved mixes to compare them at one current valuation.

I apply an explicit price shock, inspect each mix's own fixed cash reserve, and download the comparison evidence. I show that calculating or loading targets records no trades. I treat share estimates as optional and check their basis before using them.

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
