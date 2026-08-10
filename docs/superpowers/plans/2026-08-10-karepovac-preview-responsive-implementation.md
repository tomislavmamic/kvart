# Karepovac Preview and Responsive Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken site header around 1024 px and replace the Karepovac hero's empty field with a truthful static preview of the future measurement display.

**Architecture:** Keep the existing routes and hero composition. Split the hook-driven site header wrapper from its presentational view so rendered markup can be tested, then render the monitoring preview as server-side semantic HTML plus a lightweight inline SVG field. The preview uses local sample constants and explicit demo labels; it has no network or storage path.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner via `tsx`, React DOM server renderer.

## Global Constraints

- Full site navigation appears only from 1280 px; narrower widths use the existing hamburger menu.
- User-facing text remains natural standard Croatian.
- The preview says both `Ogledni podaci` and `Nisu stvarna mjerenja`.
- Sample station readings and the wind-derived estimate remain semantically and visually distinct.
- Use Croatian decimal commas and keep `H₂S` unchanged.
- Do not add thresholds, health judgements, alerts, NH₃ values, APIs, persistence, or interactivity.
- Preserve the existing routes, left hero content, project preparation claims, palette, typography, and component geometry.

---

### Task 1: Keep the site header intact at 1024 px

**Files:**
- Create: `src/components/site-header.test.tsx`
- Modify: `src/components/site-header.tsx:15-101`
- Modify: `package.json:6-12`

**Interfaces:**
- Consumes: `pathname`, open state, and the existing navigation links.
- Produces: `SiteHeaderView({ pathname, open, onToggle, onClose })`, rendered by `SiteHeader` and directly testable without a navigation context.

- [ ] **Step 1: Add the failing rendered-markup test**

Create `src/components/site-header.test.tsx` using `renderToStaticMarkup` and assert that the full navigation contains `xl:flex`, while the hamburger and dropdown contain `xl:hidden`. Assert that those visibility controls do not contain `lg:flex` or `lg:hidden`.

Update the test script to include the new file:

```json
"test": "tsx --test src/lib/karepovac.test.ts src/app/karepovac/copy.test.ts src/components/site-header.test.tsx"
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/components/site-header.test.tsx`

Expected: FAIL because `SiteHeaderView` is not exported and the current responsive classes switch at `lg`.

- [ ] **Step 3: Extract the presentational header and change the breakpoint**

Keep `SiteHeader` responsible for `useState` and `usePathname`. Move the existing JSX into an exported `SiteHeaderView` with this interface:

```ts
type SiteHeaderViewProps = {
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};
```

Use `xl:flex` for the full navigation and `xl:hidden` for both the hamburger and dropdown. Add `whitespace-nowrap` to individual full-navigation links and the primary action so Croatian labels never break internally.

- [ ] **Step 4: Run the focused and full tests**

Run:

```bash
npx tsx --test src/components/site-header.test.tsx
npm test
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add package.json src/components/site-header.tsx src/components/site-header.test.tsx
git commit -m "fix: keep site navigation intact at tablet widths"
```

### Task 2: Render the future measurement preview

**Files:**
- Create: `src/components/karepovac/project-components.test.tsx`
- Modify: `src/components/karepovac/project-components.tsx:69-116`
- Modify: `package.json:6-12`

**Interfaces:**
- Consumes: no external data; sample values live beside `MonitoringField` and are never exported as readings.
- Produces: server-rendered `MonitoringField` markup with `data-preview="true"`, measurement groups marked `data-kind="measurement"`, and the estimate group marked `data-kind="estimated"`.

- [ ] **Step 1: Write the failing preview contract**

Render `<MonitoringField />` with `renderToStaticMarkup`. Assert these visible strings:

```text
Ogledni podaci
Nisu stvarna mjerenja
Postaja A
Postaja B
Postaja C
1,8 ppb
4,2 ppb
2,6 ppb
Vjetar
SZ · 3,2 m/s
Procjena prema vjetru
Prema jugoistoku
```

Also assert that the rendered markup contains at least one `data-kind="measurement"`, exactly one `data-kind="estimated"`, and the root `data-preview="true"` marker.

Add this test file to the explicit `npm test` script.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/components/karepovac/project-components.test.tsx`

Expected: FAIL because the current component renders only the empty state and none of the preview semantics.

- [ ] **Step 3: Implement the static monitoring preview**

Replace the current empty-state composition inside `MonitoringField` with:

- a top label `Ogledni podaci` and adjacent disclaimer `Nisu stvarna mjerenja`;
- the existing restrained grid and central `Karepovac` marker;
- three generic station markers positioned around the source, each showing its letter and sample H₂S value;
- a sky-blue wind arrow or directional field labelled by text, never by colour alone;
- a bottom responsive definition list with `Postaja B / H₂S 4,2 ppb / 13:10`, `Vjetar / SZ · 3,2 m/s`, and `Procjena prema vjetru / Prema jugoistoku`;
- `grid-cols-2` on the narrow field with the estimate spanning both columns, and three columns from `sm` upward.

Keep all explanatory prose at 1rem or larger. Instrument labels and values may use the existing dense 0.875rem role. Use no gradients or resting card shadows.

- [ ] **Step 4: Run the focused and full tests**

Run:

```bash
npx tsx --test src/components/karepovac/project-components.test.tsx
npm test
```

Expected: both commands pass, with the existing preparation-state and Croatian-copy tests still green.

- [ ] **Step 5: Commit**

```bash
git add package.json src/components/karepovac/project-components.tsx src/components/karepovac/project-components.test.tsx
git commit -m "feat: preview future Karepovac measurements"
```

### Task 3: Verify the finished surface

**Files:**
- Test: all files changed in Tasks 1–2

**Interfaces:**
- Consumes: final responsive header and static monitoring preview.
- Produces: verified build and a user-visible preview ready for browser inspection.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npm run lint
node /Users/tomo/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json src/components/site-header.tsx src/components/karepovac/project-components.tsx
DATABASE_URL=postgresql://build:build@127.0.0.1:1/build npm run build
```

Expected: tests and lint pass, the detector reports no blocking findings, and the production build exits 0 with all six Karepovac routes present.

- [ ] **Step 2: Verify responsive behavior**

Inspect `/karepovac` at 390 px, 1024 px, and 1450 px:

- 390 px: wordmark and hamburger stay on one line; preview labels and data cards do not overflow.
- 1024 px: full navigation remains hidden and the hamburger is visible.
- 1450 px: full navigation is one unbroken line and the hamburger is hidden.
- Every width clearly shows that preview values are not real measurements.

- [ ] **Step 3: Commit verification fixes only if needed**

If verification requires a correction, add a failing regression first, make the smallest fix, rerun Step 1, and commit:

```bash
git add package.json src/components/site-header.tsx src/components/site-header.test.tsx src/components/karepovac/project-components.tsx src/components/karepovac/project-components.test.tsx
git commit -m "fix: polish Karepovac preview responsiveness"
```
