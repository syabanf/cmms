# Plant view: live 3D site dashboard

Approved 5 Oct 2026. Reference: the WareTrack concept video (a 3D yard with floating cards), adapted to maintenance data.

## Decisions
- The scene shows the plant floor: every machine at the current site in its building, area and line, with live status.
- Rendering: three.js through @react-three/fiber and @react-three/drei, loaded only with this page.
- Layout: built automatically from the location tree (plant → area → line), with no new data to maintain.

## Page and route
- Nav section **Plant view** after Dashboard, route `/plant`, lazy-loaded.
- From `xl` up the page fills the space under the header: one rounded card holds the canvas, and WIT cards float over it. Below `xl` the canvas is a card 58% of the screen tall and the same cards stack below it.
- The selected machine lives in `?asset=<id>` (replace), so other pages can deep-link. The asset passport gets a "Show on plant view" link.

## Scene
- Changed after approval (5 Oct 2026): the scene shows the inside of the factory, with no road, trees or outdoor ground.
- One building with a single floor: tall back and side walls with high windows, an open front, columns, and racks along the back wall. Each plant location is a hall, and partitions with a doorway separate the halls.
- Each area is a raised pad with its name at the front corner; each line is a marked row. Areas without lines (utility rooms) hold their machines in rows of their own.
- A wall the camera stands behind is cut away, so no angle hides the floor.
- Machines are spaced evenly along their row, sorted by code, each drawn as a low-poly model chosen by its asset type icon.
- Colours come from the token mirror in `apps/admin/src/lib/brand.ts`. Machines are white and grey; a down machine takes the accent (the one accent on screen); standby is greyed; the selected machine gets a ring.
- Pins: accent for down (pulses), info for work in progress, warning for waiting. From afar a pin shows its icon alone; up close, hovered or selected it opens to the machine code and the initials of the technicians on the clock. Area names step aside while the plant is too small on screen to fit them.
- The opening view fits the whole building. On a portrait canvas (phones) the camera looks in from the end of the building, so its long side runs up the screen.

## Floating cards
- Top left: machines running (n of m), active work orders (with in progress and waiting), technicians at work. A stat click switches the list tab.
- Top right: the selected machine (type, class, name, code, status, location, open work, last failure) with "Open passport" and "New work order".
- Right edge: zoom in, zoom out, rotate left, rotate right, reset view.
- Bottom left: work order tracking, the lifecycle steps of the selected machine's most urgent open work order (the site's most urgent when nothing is selected) and a mini card linking to it.
- Bottom right: tabs Attention (down, P1, overdue), Work (active orders), People (clocked in). A row click or Enter selects the machine and flies the camera to it.

## Code
- `pages/plant/layout.ts`: pure, locations + machines → halls, zones, rows and machine positions.
- `pages/plant/lib.ts`: pure, machine state, pins, stats, tracking order, list rows.
- `pages/plant/scene/*`: the canvas, lights, factory building, machine models, labels and pins, camera rig.
- `pages/plant/PlantViewPage.tsx` and its overlay cards compose the page from `useScoped()`.

## Behaviour and fallbacks
- `frameloop="demand"`, DPR capped at 2, one shadow-casting light.
- A loading line with a spinner while the 3D chunk loads; an EmptyState with a link to Assets when WebGL is missing.
- Reduced motion: the camera jumps instead of flying, pins do not pulse.
- Canvas `role="img"` with a summary label; every machine reachable by keyboard through the list card.

## Checks
`pnpm typecheck`, `pnpm build`, chunk size of the page, browser checks at 1440, 768 and 375 with screenshots, and the wit-code-agent reports (laporan bisnis and laporan teknis).
