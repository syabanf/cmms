# Frontend conventions

How the CMMS frontend is put together, and the rules every page follows. Read this before adding a screen.

## Layers

```
packages/types      domain model only: enums.ts (unions + *_LABEL maps), entities.ts
packages/fixtures   seed JSON (generated), reducer store, pure derivations (kpi, pm, reliability, calendar,
                    history, notifications, inventory, wo, factories, format, dates, permissions, org)
packages/ui         component kit, no domain imports (Button, Card, DataTable, Combobox, charts, Rail…)
apps/admin          desktop console (planner, supervisor, manager, warehouse, admin)
apps/mobile         technician and requester PWA
```

Dependencies point down only. Pages compose; business rules live in `@cmms/fixtures`.

## Data flow in the admin app

- `useScoped()` (`apps/admin/src/state/scoped.ts`) is the only way a page reads data. It returns the
  current site's collections (`assets`, `workOrders`, `requests`, `pmSchedules`, `rcas`, `tools`, `stock`,
  `stockTxns`, `calibrations`, `meters`, `meterReadings`, `documents`, `bom`, `warrantyClaims`, `people`,
  `technicians`, `teams`, `locations`, `warehouses`, `warehouseIds`, `costCenters`), shared master data
  (`parts`, `jobPlans`, `vendors`, `failureCodes`, `safetyItems`, `skills`, `assetTypes`, `settings`),
  lookup maps under `maps.*` (`maps.asset.get(id)`, `maps.person`, `maps.part`, `maps.workOrder`, …),
  helpers `personName(id)` and `locationPath(locationId)`, the signed-in `user`, `site`, and `dispatch`.
- `dispatch(action)` sends an `AppAction` (see `packages/fixtures/src/store.ts`). The provider stamps
  `by` (current user) and `at` (app clock) on every action. Never mutate state or copy store data into
  local state; derive with `useMemo` from the scoped lists.
- The app clock starts at 22 Sep 2026 09:41 WIB (`FIXTURE_NOW`) and ticks in real time. Use `nowMs()` /
  `nowIso()` from `@cmms/fixtures`, never `Date.now()`, and `useNow()` when something must re-render.
- Dates always render through `fmtDate`, `fmtDateShort`, `fmtDateTime`, `fmtTime`, `fmtWhen`, `fmtAgo`;
  money through `fmtIdr` (Rp 125.000) or `fmtIdrShort` (Rp 12,5 jt); numbers through `fmtNumber`;
  durations through `fmtDuration(minutes)`. No inline `toLocaleString` in JSX.
- Date inputs: `<Input type="date|datetime-local">` with `toDateInput` / `toDateTimeInput` and `fromInput`.

## Shared admin pieces

- `components/badges.tsx`: `WoStatusBadge`, `PriorityBadge`, `CriticalityBadge`, `WoTypeBadge`,
  `AssetStatusBadge`, `RequestStatusBadge`, `SeverityBadge`, `CalibrationBadge`, `StockBadge`,
  `OutcomeBadge`, `ToolStatusBadge`, `RcaStatusBadge`, `ApprovalBadge`.
- `components/links.tsx`: `paths.*` route builders, `AssetLink`, `WoLink`, `PersonAvatar`, `PeopleStack`,
  `PersonChip`.
- `components/icons.tsx`: `AssetIcon` (asset type icon key → lucide), `WoTypeIcon`.
- `components/pickers.tsx`: searchable pickers `AssetPicker`, `PersonPicker`, `PeoplePicker`, `PartPicker`,
  `ToolPicker`, `VendorPicker`, `TeamPicker`, `JobPlanPicker`, `LocationPicker`, `FailureCodePicker`,
  `AssetTypePicker`. Every data-backed dropdown is one of these (or a `Combobox`). `NativeSelect` only for
  fixed enums of six or fewer values.
- `components/create.tsx`: `useCreate()` opens the global dialogs: `workOrder(preset?)`,
  `editWorkOrder(wo)`, `request(assetId?)`. A preset with `requestId` converts that request.
- `lib/storage.ts`: `usePersistentState(key, initial)` for per-viewer preferences (keys `cmms.admin.*`).
- `auth/auth.tsx`: `useAuth()` gives `can(permission)`; hide or disable actions the role may not take.

## Routes and deep links

List pages get the section pill tabs from the layout automatically; do not add your own section nav.

Every record opens on its own page. There are no side panels that slide over the list:
- Detail routes: `/assets/:id`, `/work/requests/:id`, `/work/orders/:id`, `/preventive/pm/:id`,
  `/preventive/job-plans/:id` (`new` creates), `/inventory/parts/:id`, `/inventory/parts/purchase-list`,
  `/inventory/tools/:id`, `/reliability/rca/:id`, `/people/technicians/:id`, `/people/vendors/:id`.
  Build links with `paths.*` from `components/links.tsx`, never by hand.
- A detail page starts with `<BackButton fallback="/list/route" />` (`components/BackButton.tsx`) above the
  title. It goes back in history when the user came from inside the app, otherwise to the fallback.
- An unknown id renders an `EmptyState` with a link to the list. A record from another site offers to
  switch site.
- Create, edit and confirm flows use centered `Dialog`s. Bottom `Sheet`s are for menus, filters and
  pickers on phones only. Never use `Sheet side="right"` or `side="left"`.
- Back must land on the list the user left. List pages keep search, filters and view toggles in
  `useHistoryState(name, initial)` (`lib/history-state.ts`), spread `useTableHistory()` onto each
  `DataTable`, and pass `initialCount`/`onCountChange` to `useLazyList`. The layout restores the scroll
  position of `main` on Back and Forward.

Query params other screens rely on:
- `?new=1` opens the create dialog (`/assets`, `/preventive/pm`), `?receive=1` opens a stock receipt (`/inventory/stock`).
- `?tab=<name>` selects a tab on detail pages that have them (`/assets/:id`).

## Look and feel (WIT UI style)

Follow `~/.claude/skills/wit-ui-style` (SKILL.md and references). In short:
- Canvas `bg-surface`, cards `rounded-card bg-card shadow-card` with no borders, one accent per region,
  ink for the second emphasis, everything else grey. Controls are pills.
- `PageHeader` (title, one-line description, actions) at the top of every page.
- Tables live inside a `Card` via `DataTable`; galleries use `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3`.
- Stat rows use `StatCard` with tinted icon tiles; the solid ink tile is for the single primary stat.
- Charts: emphasis form (grey context, one accent mark), single series, tooltips on hover and focus,
  no dual axes, text never in the series colour.
- Every grid that sets columns at a breakpoint starts with `grid-cols-1`. Arbitrary templates use
  `minmax(0,…)` tracks (`xl:grid-cols-[minmax(0,1fr)_340px]`, never a bare `1fr` or `1.5fr`): a bare fr
  track grows to its widest nowrap child and pushes the page sideways. Flex rows with a trailing button
  get `flex-wrap gap-2`. No negative-margin bleed inside the admin `main` (it scrolls).
- Tables on phones: give secondary columns `hideBelow: 'sm'` (or wider) and repeat the essentials as a
  compact line inside the first cell (`mt-1.5 flex flex-wrap gap-1.5 sm:hidden`), so a phone never has to
  scroll a table sideways.
- Check phone (375), tablet (768) and desktop widths: `main.scrollWidth` must equal `main.clientWidth`.
- On phones, menus and filters open as bottom sheets (`ActionMenu`, `Combobox` and `Sheet side="bottom"`
  already do this).
- Empty states always name the next action. Every button does something real, and actions confirm with
  `toast(...)`. Destructive actions go through `ConfirmDialog`.

## Domain rules the store enforces

- **Safety.** A job plan's `safety` lists `loto` (yes or no), `lotoIds` (lock-out points), `permitIds`
  (permits), `hazardIds` and `ppeIds`; all are safety items from master data. A work order copies the
  plan's list. A permit counts as held when its name matches one of the technician's `authorizations`.
- **Tools.** Every check-out and return lands in `toolMovements`; the tool's own `status` says where it
  is now. Tools never get work orders: send a measuring tool out with status `calibration`, and saving
  its calibration record brings it back (`available`, or `maintenance` when it failed).
- **Requests** keep every triage decision in `events`; `triagedBy`, `triagedAt` and `triageNote` hold the
  latest one. Completing any work order whose checklist has a warning or failed line raises a request
  from that work order (`inspectionWoId`), whatever the work type.
- **PM.** The store provider dispatches `pm/autoGenerate` on load and every minute (as "PM scheduler",
  `by: 'system'`): a work order appears once a schedule's lead time starts. Deleting a schedule cancels
  its generated work that nobody started; work in progress keeps running.
- **Asset types** carry `defaultScores`: the criticality scores a new asset of that type starts with.
- **Photos** carry `stage` (before, after or null) so the machine history can tell them apart.
- **Persisted state.** Each app keeps its state in local storage under a version number
  (`packages/fixtures/src/persistence.ts`). Bump `STORAGE_VERSION` whenever the state shape changes, so
  older saved states fall back to the seed.

## Accessibility and print

- A picker or input without a visible label gets an `aria-label`. Icon-only buttons get `aria-label`.
  A `Combobox` with an `id` is named by its `FormField` label; without one, its placeholder names it.
- `PageHeader` renders the page's `h1` and `CardTitle` renders `h2`; headings inside a card start at `h3`.
- The layout has a "Skip to content" link that jumps to `main`. Dialogs and sheets trap focus and close
  on Escape (Radix). Every control shows a focus ring (`focus-visible:ring-2 ring-accent/40`).
- A `<dl>` holds only `dt` and `dd` pairs (optionally wrapped in `div`); put icons inside the `dt`.
- Print: the shell hides the rail, header, tabs and card actions (`print:hidden`), cards get a hairline
  border and never split across pages, and `main` stops scrolling so the whole job card prints.
  `QrLabel` prints the label alone by hiding everything else on `body`.
- White text on the accent red is 4.4:1, under the 4.5:1 AA threshold for small text. Keep body copy
  off accent backgrounds; the brand colour stays as it is unless the product owner changes it.

## Writing

UI copy, comments and docs: no em or en dashes (use a period, comma, colon or hyphen), no filler
adverbs, active voice, specific nouns. Sentence case for labels and titles.

## Checks

`pnpm typecheck` and `pnpm build` must pass. Strict TypeScript, no `any`, `import type` for types.
