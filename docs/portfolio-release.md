# My CapitalScope portfolio release

I finished the scoped portfolio workbench: company financial evidence, explicit valuation models, peer research, saved theses, raw-price analysis, and manual portfolio simulation. I kept the example workspace usable without provider credentials and kept product expansion separate from this release.

## My verified starting point

I use Java 17, Maven 3.9+, and Node.js 22 for the documented build. CI uses Node 22; my local clean-checkout release check also ran with Node 24.

```bash
bash scripts/build.sh
java -jar backend/target/capitalscope-0.1.0.jar
```

I open http://localhost:8080. I launch from a writable directory because the default H2 database is stored in `./data`, relative to the launch directory. I keep that directory to retain saved records. I stop the process with Ctrl+C.

I can check the packaged app with:

```bash
bash scripts/smoke-test.sh
npm run test:integration --prefix frontend
```

I install the browser once before integration tests with `cd frontend && npx playwright install --only-shell chromium`. On a minimal Linux host I may also need Playwright's system dependencies.

## What I verified

| Check | My evidence |
| --- | --- |
| Clean-checkout build | I installed frontend dependencies, built the dashboard, and ran Maven verification/package creation from a separate checkout. |
| Java checks | I passed 70 tests locally with no failures, errors, or skips; CI separately runs database checks against PostgreSQL. |
| Runnable app | I ran the packaged smoke check for the dashboard asset, 50-company catalog, labeled fictional financials, and the $90 valuation case. |
| Browser workflows | I passed all 32 packaged-app integration tests locally and retained the full frontend suite and packaged-app integration suite as PR merge gates. |
| Layout | I reviewed all eight sections at 1440, 390, and 320 pixels and recorded the fixture scope in [my workflow review](workflow-review.md). |
| Initial download | I reduced the local production entry script from about 502 KB to 267 KB and enforce a 300000-byte / 100000-gzip-byte entry budget. |
| Screenshots | I captured the README desktop and mobile financials screens from the packaged app, using its explicitly labeled invented figures. |

I distinguish a successful example demo and synthetic/provider-contract tests from actual upstream coverage.

## What I leave explicit

- I did not configure a real SEC contact identity or Alpha Vantage key in this release environment, so I did not verify live imports or all 50 companies' coverage.
- I provide Docker/Compose configuration, but Docker was unavailable locally and container packaging is not exercised in the current CI workflows. I use the verified jar route for the demo.
- I keep the database shared, without login or private workspaces. I do not present this release as a hosted private multi-user service.
- I use dated, unadjusted closes and manual simulated events. I do not claim broker execution, total-return portfolio performance, verified corporate actions, or point-in-time backtesting data.

## My demo and next phase

I use [my demo walkthrough](demo-walkthrough.md) for the key-free flow and a separate optional live-data extension. I keep API credentials and contact details out of screenshots and commits.

I have reached the portfolio release finish line. I treat accounts/private workspaces, public hosting, verified adjustments, historical returns, and specialized sector models as later product work, rather than extending this release indefinitely.
