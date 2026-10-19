# My desktop and mobile workflow review

I reviewed the release UI on 2026-10-19 at 1440, 390, and 320 pixels wide. I kept the warm paper/copper palette and serif headings, and I inspected representative screenshots of the financials, valuation, comparisons, prices, portfolios, watchlist, and summary layouts.

## My checks

- I opened all eight workspace sections at each width, checked the selected navigation state, and checked for page-wide horizontal overflow, section-load failures, visible errors, and uncaught browser errors.
- I used invented financial and price fixtures, empty saved collections, and an empty portfolio list for this layout sweep. I did not treat it as a live-provider test or a replacement for saved-record and calculation tests.
- I separately opened populated portfolio holdings, fill history, and a missing-price valuation at 320 pixels. I checked labeled keyboard focus and scroll controls, preserved the unavailable portfolio total, and checked that controls disappear when the tables fit at desktop width.
- I checked the daily-price table with the same narrow/desktop scroll behavior. I kept full values in the horizontally scrollable table instead of shrinking them to fit.

## My fixes

I brought daily prices, portfolio cost-basis holdings, simulated fill history, and portfolio stored-price evidence into the existing EvidenceTable component. I added explicit column-header scopes. I retained the original captions, values, API behavior, and print layout.

## How I repeat the focused review

```bash
npm run test:e2e --prefix frontend -- -g 'I review every workspace section|I reach narrow price'
```

I can set `CAPITALSCOPE_REVIEW_SCREENSHOTS` to an output-directory path to capture the layout sweep. I keep these QA captures separate from the curated release screenshots.

I also require the full browser and backend/package workflows on the feature PR. Those retain the existing checks for company selection, source links, saved valuations, research, prices, portfolio calculations, stale responses, and exports.

## What I still need before the portfolio release

I completed the follow-up release/demo documentation, screenshots, and packaged launch check in [my release notes](portfolio-release.md). I recorded the live-provider and Docker checks I could not perform. This layout review uses fixtures and does not establish live SEC or price-provider coverage.
