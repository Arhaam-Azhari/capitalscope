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
- Docker was unavailable during my local release checks. I subsequently added a [container CI check](container-check.md) for image build, standalone H2 and Compose/PostgreSQL startup, and persistence across recreation; I keep the original local jar evidence separate.
- I keep the database shared, without login or private workspaces. I do not present this release as a hosted private multi-user service.
- I use dated, unadjusted closes and manual simulated events. I do not claim broker execution, total-return portfolio performance, verified corporate actions, or point-in-time backtesting data.

## My demo and next phase

I use [my demo walkthrough](demo-walkthrough.md) for the key-free flow and a separate optional live-data extension. I keep API credentials and contact details out of screenshots and commits.

I have reached the portfolio release finish line. I treat accounts/private workspaces, public hosting, verified adjustments, historical returns, and specialized sector models as later product work, rather than extending this release indefinitely.

## How I keep browser CI setup bounded

I run [my browser dependency setup](../scripts/install-browser-deps.sh) only on Linux GitHub Actions runners. I create a temporary APT configuration with two retries and 30-second HTTP/HTTPS connection and data timeouts, then remove that file when setup exits. I preserve the runner’s existing configuration files. I give system dependency installation five minutes and the separate Chromium headless-shell download three minutes, with a 30-second browser download socket timeout. These bounds help identify setup failures separately from test failures; they do not guarantee that an unavailable package mirror will recover.

I use the installed, locked Playwright package for both setup steps. I run the full frontend and packaged-app integration suites after setup succeeds, and keep failed setup or tests as merge blockers. I do not retry or suppress failed tests in this setup script. I keep the container/persistence job separate. For local setup, I still use the ordinary Playwright install command above.

I follow the documented [APT transport timeout behavior](https://manpages.debian.org/bookworm/apt/apt-transport-http.1.en.html), [APT retry setting](https://manpages.ubuntu.com/manpages/jammy/man5/apt.conf.5.html), and [Playwright browser installation options](https://playwright.dev/docs/browsers).
