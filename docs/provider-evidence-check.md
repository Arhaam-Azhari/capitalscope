# My provider evidence check

I use this command after starting CapitalScope to inspect one catalog company and one provider. I keep configuration, usable API evidence, and fresh upstream access separate. A successful API read may use a cached snapshot; this command does not force a provider refresh.

## I choose one check

From the repository root, with Node.js 22 and the app running:

```bash
npm run check:provider --prefix frontend -- --provider sec --ticker AAPL
npm run check:provider --prefix frontend -- --provider prices --ticker AAPL
```

I run those separately so I can inspect each result before spending another provider request. I can target another app origin with `--base-url http://127.0.0.1:8080`. I omit credentials, query strings, and URL paths from that argument. I use a ticker from the app's fixed catalog; `DEMO` is deliberately rejected.

I configure `SEC_USER_AGENT` or `ALPHA_VANTAGE_API_KEY` on the app server and restart it before checking that provider. I never pass these values to this command. The command does not load an `.env` file or start the app. I use [the launch guide](../README.md#run-the-app) for server setup.

## I interpret the report

I print a JSON report to standard output with schema version, app origin, company/provider, check times, configuration status, last HTTP status, evidence coverage, and available retrieval dates. I can redirect standard output to a private report file if I want to retain a result.

| Status | What I established |
| --- | --- |
| `evidence_available` | I received the expected real-data mode and identity, plus all five supported SEC metrics with at least one annual period each, or at least one valid raw USD close. This is availability, not a completeness or freshness guarantee. |
| `partial_coverage` | I received usable SEC facts for some supported metrics; other metrics had no annual values. |
| `no_coverage` | I received the expected response identity but no supported annual facts or price observations. |
| `setup_needed` | I observed missing provider configuration and stopped before requesting the catalog or company evidence. Cached data may still exist in the app; I did not inspect it in this check. |
| `not_in_catalog` | I found no matching ticker in the app's catalog and did not request company evidence. |
| `invalid_response` | I could not establish the expected API shape, data mode, identity, dates, or evidence fields. I do not count fictional, duplicate, or mismatched evidence as coverage. |
| `request_failed` | I could not complete an API request. I include an HTTP status when available, but omit raw errors, response bodies, contact details, and keys. I inspect the app privately to diagnose the cause. |

I use exit code **0** for `evidence_available`, **2** for every other report status, and **1** for invalid command arguments. I preserve partial coverage in the JSON while treating it as an incomplete check for automation. Each request has a 45-second timeout; requests run sequentially and are not automatically retried. I reject HTTP redirects rather than following them to another origin.

## I keep the verification scope narrow

For SEC data, I check the requested company, `sec` data mode, retrieval/served timestamps, the five supported USD metrics, distinct valid annual end dates, filing dates, finite values, accounting tags, and SEC archive source links. I retain negative and zero facts. I report annual-period counts and the latest available end date for each supported metric; I do not re-audit the accounting facts or establish full tag coverage.

For prices, I check the ticker, `market` mode, USD currency, unadjusted flag, retrieval timestamp, distinct valid observation dates, and finite positive closes. I report observation count and date span. I do not verify an exchange calendar, adjustments, current quote availability, total returns, or every OHLC field.

I preserve old retrieval dates rather than relabeling cached evidence as fresh. I do not infer upstream access from configuration flags or a successful cached read. The app's ordinary company-data endpoint may import and cache provider data when needed; this command sends no portfolio, watchlist, saved-case, or trade mutations. It does not bypass app/provider rate limits.

I check one company at a time and do not automatically sweep all 50 catalog entries. I record any actual live results separately from synthetic contract tests. The repository's fixture checks and key-free packaged-app check do not establish live SEC or Alpha Vantage coverage.
