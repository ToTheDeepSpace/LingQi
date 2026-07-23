# Design QA: Jumulu Encyclopedia Home

## Evidence

- Source visual truth: `/Users/mima0000/.codex/generated_images/019ef61a-efb2-7d73-a9bb-fa33307badd6/exec-60e19877-343b-4db0-b30c-5b2775d1c848.png`
- Browser-rendered implementation: `/private/tmp/LingQi-miniapp-20260721/design-qa-implementation-final.png`
- Combined comparison: `/private/tmp/LingQi-miniapp-20260721/design-qa-comparison-final.png`
- Route: `http://127.0.0.1:4173/#/`
- State: signed out, public production data loaded through the local H5 development proxy, page scrolled to top
- CSS viewport: `390 x 844`, device pixel ratio `1`
- Source pixels: `853 x 1844`
- Browser capture pixels: `375 x 812`
- Density normalization: source resized to `375 x 812`; implementation kept at captured `375 x 812`; both placed in one `770 x 852` comparison image

## Full-View Comparison

The implementation preserves the selected direction's information hierarchy: compact brand header, encyclopedia search, four taxonomy entries, one editorial feature, a four-row newly added list, a visible start of the community-completion section, and a fixed five-item bottom navigation. The implementation uses approved public production images and data instead of reproducing the mock's invented posters, scores, or play counts.

## Required Fidelity Surfaces

- Fonts and typography: the serif display treatment is retained for the brand and featured title; product copy uses the existing PingFang/system stack. Weight and line-height remain readable at the mobile viewport, with no negative letter spacing or clipped labels.
- Spacing and layout rhythm: section separators, compact list rows, restrained 7-10rpx radii, and the first-viewport content sequence match the source. The fixed tab bar does not resize or overlap the active content row.
- Colors and visual tokens: warm white, neutral dark text, fine gray dividers, and restrained amber actions match the selected mock and the existing Jumulu design tokens. No gradient or decorative card wall was introduced.
- Image quality and asset fidelity: content imagery comes from approved public records at its original URL and uses controlled `aspectFill` crops. UI icons are licensed Tabler PNG assets, with separate neutral and selected states; no emoji, CSS drawings, or handcrafted SVG substitutes are used.
- Copy and content: the marketing homepage copy and duplicate shortcut cards are removed. Visible text now frames the product as an immersive-entertainment encyclopedia and uses the approved navigation labels `百科 / 口碑 / 委托 / 拼车 / 我的`.

## Focused Region Comparison

No separate crop was required because the normalized side-by-side frame keeps the header/search/taxonomy, feature, list rows, community-section lead-in, and tab bar readable at the same time. The combined comparison was inspected at original resolution.

## Interaction Verification

- Search field: entering `春诗` replaced the feed with four matching DM and reputation results.
- Taxonomy navigation: tapping `场馆` navigated to `#/pages/stores/index`.
- Public data: feature and recent rows loaded from the existing API.
- Browser console: no warnings or errors in the final state.
- Build verification: `vue-tsc --noEmit`, WeChat mini-program build, and `git diff --check` passed.

## Comparison History

### Iteration 1

- P2: five recent rows pushed `等待大家完善` entirely below the first viewport, changing the selected direction's above-the-fold hierarchy.
- P2: full ISO dates wrapped across two lines in the narrow metadata column.
- Fixes: limited recent records to four and rendered dates as `MM.DD`.
- Post-fix evidence: `design-qa-implementation-final.png` shows the community section lead-in above the tab bar and all dates on one line.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: the source mock includes richer script metadata and a player-avatar cluster that the current public endpoints do not provide consistently. The implementation intentionally omits invented statistics and displays real approved data instead.
- P3: the H5 comparison does not render the WeChat capsule control. This is platform-owned chrome and will appear in the WeChat runtime.

## Implementation Checklist

- Keep the encyclopedia feed backed by approved public records.
- Keep four recent rows at the current mobile density.
- Re-run this comparison if the home API payload or tab structure changes.

final result: passed
