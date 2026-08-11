# Karepovac Public Pages Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-driven development and verify every command before claiming completion.

**Goal:** Add a visible, mobile-first Karepovac subproject to Kvart that truthfully presents the preparation stage, participation paths, methodology, future data contract, finances, and the currently empty station network.

**Architecture:** Use a nested Next.js App Router layout under `src/app/karepovac` for shared project navigation and static metadata. Keep all preparation-stage truth and route definitions in a typed `src/lib/karepovac.ts` module so tests can enforce that the public UI does not imply live measurements, stations, donation totals, or an active collection mechanism. Pages remain Server Components and reuse a small set of presentation components.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server Components, TypeScript, Tailwind CSS 4, Node's built-in test runner through `tsx`.

---

### Task 1: Lock the public content contract with tests

**Files:**
- Modify: `package.json`
- Create: `src/lib/karepovac.test.ts`
- Create: `src/lib/karepovac.ts`

**Step 1: Write the failing test**

Test that the project is explicitly `U pripremi`, exposes all six public routes, has no active donation URL, reports no public stations, and distinguishes community measurements, official measurements, and estimated wind transport.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `src/lib/karepovac.ts` does not exist.

**Step 3: Write the minimal implementation**

Add immutable route, status, source-kind, and preparation-state definitions. Add `npm test` using `tsx --test`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

### Task 2: Build the shared Karepovac page language

**Files:**
- Create: `src/components/karepovac/project-nav.tsx`
- Create: `src/components/karepovac/project-components.tsx`
- Create: `src/app/karepovac/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add shared components**

Create the local project navigation, preparation status strip, honest no-data board, source legend, section heading, action/link styles, and simple authored SVG marks. Keep components semantic and server-rendered unless route awareness requires a small Client Component.

**Step 2: Add the nested layout**

Export static metadata, render the project masthead and local navigation once, and wrap child pages in a coherent paper-and-record surface that inherits `DESIGN.md`.

**Step 3: Add scoped visual behavior**

Use Tailwind utilities for the structure and a small amount of global CSS only for the project's restrained animated wind-line motif, with a reduced-motion fallback.

### Task 3: Implement every visible preparation-stage route

**Files:**
- Create: `src/app/karepovac/page.tsx`
- Create: `src/app/karepovac/ukljuci-se/page.tsx`
- Create: `src/app/karepovac/metodologija/page.tsx`
- Create: `src/app/karepovac/podaci/page.tsx`
- Create: `src/app/karepovac/financije/page.tsx`
- Create: `src/app/karepovac/postaje/page.tsx`

**Step 1: Implement the hub**

Show what is known now, why no readings or plume appear yet, the intended three-part evidence model, project phases, and the clearest next action.

**Step 2: Implement participation and transparency pages**

Explain how residents will donate or host a station while keeping those actions visibly inactive until recipient, privacy, and host terms exist. Show budget categories without invented amounts or totals.

**Step 3: Implement methodology, data, and stations pages**

Explain H2S-first validation, quality gates, measured/official/modelled separation, intended open-data output, siting principles, and the honest empty station state.

### Task 4: Join the subproject to the main site

**Files:**
- Modify: `src/components/site-header.tsx`

**Step 1: Add Karepovac to global navigation**

Add a global link and make nested Karepovac paths register as active. Keep the full navigation collapsed until the `lg` breakpoint so the additional item does not crowd tablet widths.

### Task 5: Verify behavior and finish the visual surface

**Files:**
- Test: all changed files

**Step 1: Run automated checks**

Run: `npm test`, `npm run lint`, `npm run build`.

**Step 2: Run the local site**

Run: `npm run dev` and verify all six routes return successful HTML.

**Step 3: Inspect desktop and mobile in one batch**

Capture `/karepovac` plus representative detail pages at desktop and phone widths. Check reading order, overflow, focus, contrast, truthful empty states, and navigation.

**Step 4: Fix material issues in one batch and confirm once**

Apply the visual findings, rerun checks, and capture one confirmation round.

**Step 5: Open the page for the user**

Keep the local development server running and open `/karepovac` in the system browser.
