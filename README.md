# CMMS frontend

Frontend for a computerized maintenance management system, built from the product brainstorm in
[docs/CMMS_Brainstorm_Complete.md](docs/CMMS_Brainstorm_Complete.md). Two apps share one typed data layer:

- **Admin console** (`apps/admin`): planners, supervisors, the maintenance manager, warehouse and admins.
  Dashboard, assets and their passports, requests, work orders, calendar, backlog, approvals, PM schedules,
  job plans, inspections, calibration, spare parts, stock, tools, failures, RCA, history, technicians,
  skill matrix, vendors, reports and master data. Every record opens on its own page. Its back button
  returns to the list with the search, filters, page and scroll position the user left.
- **Technician PWA** (`apps/mobile`): the phone app from section 41 of the brainstorm. A work order runs
  as a six-step flow (job, safety, checklist, parts and tools, findings, finish): the technician starts
  behind a safety check, fills typed checklists, clocks labor, uses parts, codes the failure and signs
  off. The app also scans asset QR codes and reports problems.

Master data (locations, asset types, failure codes, safety items, skills, teams, cost centers and
warehouses) is edited under Settings › Master data in the console, and the phone reads the same lists:
failure codes in the Findings step, safety items in the Safety step, locations for "my area".

There is no backend yet. Both apps run on seeded fixtures through a reducer store, so every button works
in the browser. Each app saves its demo state in local browser storage, which keeps changes across reloads.
The apps still keep separate copies, so a change made in the console does not reach the phone.

## Run it

```bash
pnpm install
```

```bash
pnpm dev:admin
```

The console opens on http://localhost:5273. Pick a demo account on the sign-in screen; each role sees the
actions it may take (Rina Kartika, Maintenance Manager, sees both sites).

```bash
pnpm dev:mobile
```

The PWA opens on http://localhost:5274. Budi Santoso is the technician the brainstorm's mobile mock
describes.

Other scripts: `pnpm typecheck`, `pnpm build`, `pnpm format`, and `pnpm gen:fixtures` to rebuild the seed data.

## The seeded story

The data is anchored to Tuesday 22 September 2026, 09:41 WIB, and the app clock ticks on from there.
Factory Bandung holds a year of history: about 465 work orders, 110 requests, PM routes, calibrations
and a consistent stock ledger. Factory Cikarang is smaller.

The brainstorm's own examples are in it. Poles-03 (criticality score 18, class A, under warranty until
June 2027) failed on bearing wear on 17 Aug, 02 Sep and 20 Sep, which trips repeat-failure detection and
RCA-2026-004 with its five whys and the CAPA to move PM-0003 from 30 days to 400 runtime hours. Today
MR-000283 became WO-2026-002819, "High vibration on spindle", assigned to Budi and Andi. The coating
conveyor is down with a P1, Oven 2 waits for a thermocouple that is out of stock, and two drafts wait for
approval.

## Layout

```
apps/admin            desktop console (Vite, React 19, React Router 7)
apps/mobile           technician PWA (same stack + vite-plugin-pwa)
packages/types        domain model: unions with label maps, entities
packages/fixtures     seed JSON, reducer store, derivations (KPIs, PM due dates, MTBF and MTTR,
                      repeat failures, backlog, calendar, history, notifications, permissions)
packages/ui           component kit in the WIT UI style (Tailwind v4, Radix, lucide)
packages/tailwind-config   design tokens
scripts               deterministic fixture generator
docs/conventions.md   how pages are built; read it before adding a screen
```

Dependencies point down only: apps use `ui`, `fixtures` and `types`; `ui` never imports domain data.

## Next steps

- Backend: `apps/api` (Fastify, Prisma, zod contracts) behind the same actions the reducer handles today,
  following the backend reference of the house style.
- Persist the store per user on the server once the API exists; browser storage only protects the local demo.
- Share one store between the console and the phone through that API, so master data edited in the
  console shows up on the phone.
- Real integrations: notification channels (email, WhatsApp, push) and ERP purchase orders for reorders.
