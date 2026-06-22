# LingQi Guide Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the first usable LingQi guide-trading prototype: users can publish guides, admins can approve them, users can buy approved guides with contract coins, creators can see income and submit withdrawal requests.

**Architecture:** Reuse the existing Express API, Supabase-style Tencent PostgreSQL adapter, wallet RPC, local moderation precheck, React lazy routes, and admin patterns. Keep user wallet separate from creator income: purchases spend contract coins; creator income records are separate ledger rows with frozen/withdrawable states.

**Tech Stack:** React + TypeScript + Vite frontend, Express TypeScript API, PostgreSQL migrations under `supabase/migrations`, existing `lc_transactions` wallet ledger and `lc_spend_wallet_balance` RPC.

---

## Files

- Create: `supabase/migrations/20260623023000_guide_trading.sql`
  - Tables: `lc_guides`, `lc_guide_purchases`, `lc_creator_income_entries`, `lc_creator_withdrawals`, `lc_guide_gifts`.
  - RPC: `lc_purchase_guide`.
- Modify: `api/index.ts`
  - Add public guide list/detail endpoints.
  - Add authed publish, purchase, mine, creator income, withdrawal endpoints.
  - Add admin guide and withdrawal review endpoints.
  - Include guides and withdrawals in `/api/lc/admin/pending`.
- Create: `src/pages/Guides.tsx`
  - Public guide marketplace list with filters and purchase/detail modal.
- Create: `src/pages/CreateGuide.tsx`
  - One-screen-priority publish form with spoiler/copyright/compliance prompts.
- Create: `src/pages/GuideIncome.tsx`
  - Creator income and withdrawal request page.
- Modify: `src/App.tsx`, `src/lib/routePreload.ts`, `src/components/Navbar.tsx`
  - Add `/guides`, `/guides/new`, `/guides/income` routes and navigation.
- Modify: `src/pages/Admin.tsx`
  - Add guide review and withdrawal tabs.
- Create: `scripts/guide-trading-smoke.ts`
  - Static smoke checks for route and endpoint text.

## Task 1: Database Foundation

- [x] Create additive migration `supabase/migrations/20260623023000_guide_trading.sql`.
- [x] Add `lc_guides` with fields for author, title, summary, content, price, spoiler level, object binding, type, status, sale status, moderation precheck, copyright confirmation, timestamps.
- [x] Add `lc_guide_purchases` with unique `(guide_id, buyer_id)`.
- [x] Add `lc_creator_income_entries` separate from user wallet.
- [x] Add `lc_creator_withdrawals`.
- [x] Add `lc_guide_gifts` for future voluntary gifts, with no unlock semantics.
- [x] Add RPC `lc_purchase_guide(p_buyer_id uuid, p_guide_id uuid)` that checks status, prevents duplicate purchases, spends wallet balance by calling `lc_spend_wallet_balance`, creates purchase row and creator income row.
- [x] Run `git diff --check`.

## Task 2: API

- [x] Add helper constants for guide statuses and spoiler levels in `api/index.ts`.
- [x] Add `GET /api/lc/guides` to list approved/on-sale guides without paid content.
- [x] Add `GET /api/lc/guides/:id` to return full content only to the author, admins, or buyers.
- [x] Add `POST /api/lc/guides` requiring auth; require title, summary, content, price, spoiler level, copyright confirmation; run local precheck; insert `pending`.
- [x] Add `POST /api/lc/guides/:id/purchase` requiring auth; call `lc_purchase_guide`.
- [x] Add `GET /api/lc/guides/mine` requiring auth.
- [x] Add `GET /api/lc/guides/income/me` requiring auth.
- [x] Add `POST /api/lc/guides/withdrawals` requiring auth; create withdrawal request for available income.
- [x] Add admin approve/reject endpoints for guides.
- [x] Add admin approve/reject endpoints for withdrawals.
- [x] Add guides and withdrawals to `/api/lc/admin/pending`.
- [x] Run `npx tsc -p tsconfig.server.json --noEmit`.

## Task 3: Frontend Routes

- [x] Add lazy loaders and route entries for `/guides`, `/guides/new`, `/guides/income`.
- [x] Add navigation/footer entries: “攻略交易”, “发布攻略”, “创作者收入”.
- [x] Keep `/guides/new` out of global navbar if it is a focused publish page, matching existing publish pages.
- [x] Run `npx tsc -b --noEmit`.

## Task 4: Guide Marketplace UI

- [x] Build `src/pages/Guides.tsx`.
- [x] Show list cards with title, summary, price, spoiler level, type, bound object, author, purchase count.
- [x] Detail modal/page shows content only when API says `can_read_content`.
- [x] Purchase button requires login; insufficient balance links to `/wallet`.
- [x] Copy must say “购买攻略 / 解锁攻略”, not “送礼解锁”.
- [x] Run `npm run lint`.

## Task 5: Guide Publish UI

- [x] Build `src/pages/CreateGuide.tsx`.
- [x] Form fields: title, summary, content, price, spoiler level, guide type, target type/name, copyright checkbox.
- [x] Show responsibility notice: no piracy, no clues, no answers, no unauthorized materials.
- [x] Submit goes to pending review.
- [x] Fit primary form on common viewports as much as possible; detailed rules collapse into compact notice.
- [x] Run `npm run lint`.

## Task 6: Creator Income UI

- [x] Build `src/pages/GuideIncome.tsx`.
- [x] Show pending/frozen, withdrawable, requested, paid totals.
- [x] List income entries and withdrawal requests.
- [x] Withdrawal form requires account type, account name, account identifier, amount.
- [x] Copy must distinguish “创作者收入” from “契约币”.
- [x] Run `npm run lint`.

## Task 7: Admin UI

- [x] Extend `src/pages/Admin.tsx` types and pending loader.
- [x] Add tab for guide review.
- [x] Add tab for withdrawal review.
- [x] Approve/reject guides with admin note.
- [x] Mark withdrawal paid/rejected with admin note.
- [x] Run `npm run lint`.

## Task 8: Verification

- [x] Run `npm run lint`.
- [x] Run `npx tsc -b --noEmit`.
- [x] Run `npx tsc -p tsconfig.server.json --noEmit`.
- [x] Run `npm run test:auth-flow`.
- [x] Run `npm run build:tencent`.
- [x] Run `git diff --check`.
- [x] Commit implementation separately from the earlier docs commits.

## Self-Review

- Spec coverage: first-stage guide publish, review, purchase, creator income, withdrawal application, wallet separation, and gift boundary are covered.
- Scope control: automatic third-party transfers and full gift UI are not in the first implementation.
- Naming consistency: public product copy uses “攻略 / 购买 / 解锁 / 创作者收入”; gift is never used as an unlock path.
