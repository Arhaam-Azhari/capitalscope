# My portfolio release finish line

I am finishing a shared, locally runnable finance research workbench. I am freezing the feature scope for this release so I can review the whole experience instead of adding more panels.

## My release passes

1. **Completed:** I reduced the initial download and verified loading/failure recovery in [PR #85](https://github.com/Arhaam-Azhari/capitalscope/pull/85).
2. **Reviewed:** I checked all eight sections at desktop, phone, and narrow-phone widths and improved price/portfolio table access. I recorded the scope and checks in [my workflow review](workflow-review.md). I require full CI before merging the review changes.
3. **Remaining:** I finish the setup/demo documentation and screenshots, check the documented launch path, and verify configured live imports where credentials and provider access are available. I record any unverified provider or packaging coverage explicitly before calling the portfolio release complete.

I treat these as three focused passes, not a promised number of hours. The final review can reveal fixes. I use passing CI as a release requirement, and I keep live-provider checks separate from synthetic fixtures and packaged-app tests.

## My release scope

I include SEC annual facts and evidence, explicit valuation assumptions, peer comparisons, research notes and history, dated prices, manual simulated portfolios, and source-aware exports. I retain the fictional example for an immediately usable demo.

I describe the database as shared and keep the documented local deployment boundary. I do not present this release as a private multi-user service or claim live coverage that I have not verified.

## My later product work

I leave accounts/private workspaces, public multi-user hosting, provider-verified corporate actions, historical portfolio returns, broader accounting-tag coverage, and specialized sector valuation models for later releases. I do not make these a condition for finishing the portfolio project.
