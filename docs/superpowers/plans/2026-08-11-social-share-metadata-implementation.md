# Social Share Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a consistent branded aerial preview and accurate page-specific Open Graph and Twitter Card text for every public route.

**Architecture:** A server-safe metadata helper owns the stable production URL, page metadata construction, and public proposal excerpts. The root layout supplies defaults, file-convention image routes generate one cached local-aerial card, and public pages opt into the helper so nested metadata cannot retain the homepage social title.

**Tech Stack:** Next.js 16.2 App Router Metadata API, `next/og` `ImageResponse`, React 19, TypeScript, Node test runner through `tsx --test`.

## Global Constraints

- Canonical metadata base is `https://kvart-sage.vercel.app`.
- Open Graph locale is `hr_HR`; site name is `Naš kvart — Dračevac i Bilice`.
- Twitter card type is `summary_large_image`.
- Share image is 1200 × 630 PNG made from a committed local aerial image.
- Image text is only `Naš kvart` and `Dračevac · Bilice`.
- Everything user-facing is Croatian and factual.
- Only already-public proposal title and description may enter proposal metadata.
- No external image service, webfont, remote runtime fetch, or private field.
- Existing visible page headings and body copy remain unchanged.

---

### Task 1: Shared metadata policy

**Files:**
- Create: `src/lib/metadata.ts`
- Create: `src/lib/metadata.test.ts`

**Interfaces:**
- Produces: `SITE_URL: URL`, `DEFAULT_SHARE_DESCRIPTION: string`, `PROBLEMS_SHARE_DESCRIPTION: string`.
- Produces: `createPageMetadata({ title, description }): Metadata`.
- Produces: `publicDescriptionExcerpt(value, fallback?, limit?): string`.

- [ ] **Step 1: Write helper tests**

Cover ordinary, Open Graph, and Twitter fields, plus whitespace collapse,
Unicode-safe word-boundary truncation, and fallback:

```ts
const metadata = createPageMetadata({
  title: "Karta kvarta",
  description: "Istraži kvart.",
});
assert.equal(metadata.openGraph?.title, "Karta kvarta — Naš kvart");
assert.equal(metadata.twitter?.card, "summary_large_image");
assert.equal(publicDescriptionExcerpt("  Prvi   red\nDrugi red  "), "x"), "Prvi red Drugi red");
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npx tsx --test src/lib/metadata.test.ts`

Expected: failure because `src/lib/metadata.ts` does not exist.

- [ ] **Step 3: Implement the policy helper**

`createPageMetadata` returns the short browser title while explicitly resolving
social titles with `— Naš kvart` exactly once:

```ts
export function createPageMetadata({ title, description }: PageMetadataInput): Metadata {
  const socialTitle = title === SITE_NAME ? SITE_NAME : `${title} — Naš kvart`;
  return {
    title,
    description,
    openGraph: { title: socialTitle, description },
    twitter: { card: "summary_large_image", title: socialTitle, description },
  };
}
```

`publicDescriptionExcerpt` collapses whitespace, converts to `Array.from` for
Unicode-safe length handling, cuts at the final word boundary inside 160
characters, and uses `…` only when truncated.

- [ ] **Step 4: Run focused tests**

Run: `npx tsx --test src/lib/metadata.test.ts`

Expected: all helper tests pass.

### Task 2: Root protocol defaults and shared aerial image

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/opengraph-image.tsx`
- Create: `src/app/twitter-image.tsx`
- Create: `src/app/social-image.test.ts`

**Interfaces:**
- Consumes: constants and `SITE_URL` from `src/lib/metadata.ts`.
- Produces: root `Metadata` with `metadataBase`, Open Graph defaults, and Twitter defaults.
- Produces: 1200 × 630 PNG image route with exported `alt`, `size`, and `contentType`.

- [ ] **Step 1: Write image-contract tests**

Assert exact size, content type, alternative text, and that Twitter reuses the
same exports:

```ts
assert.deepEqual(size, { width: 1200, height: 630 });
assert.equal(contentType, "image/png");
assert.match(alt, /Zračna snimka Dračevca i Bilica/);
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npx tsx --test src/app/social-image.test.ts`

Expected: failure because the image modules do not exist.

- [ ] **Step 3: Add root metadata defaults**

Extend root metadata with:

```ts
metadataBase: SITE_URL,
openGraph: {
  type: "website",
  locale: "hr_HR",
  siteName: SITE_NAME,
  title: SITE_NAME,
  description: DEFAULT_SHARE_DESCRIPTION,
},
twitter: {
  card: "summary_large_image",
  title: SITE_NAME,
  description: DEFAULT_SHARE_DESCRIPTION,
},
```

- [ ] **Step 4: Generate the shared image from a local aerial asset**

Read `public/photos/dracevac-dof.jpg`, embed it in an `ImageResponse`, cover the
canvas, add a legibility overlay, and render the two approved identity lines.
Use only flexbox-compatible Satori styles and the system font.

- [ ] **Step 5: Re-export the same image for Twitter**

`twitter-image.tsx` re-exports `alt`, `size`, `contentType`, and the default
renderer from `opengraph-image.tsx` so both consumers receive identical pixels.

- [ ] **Step 6: Run image-contract tests and a production build**

Run: `npx tsx --test src/app/social-image.test.ts`

Run: `npm run build`

Expected: tests pass and Next.js recognises both metadata image conventions.

### Task 3: Page-specific social copy

**Files:**
- Modify: `src/app/karta/page.tsx`
- Modify: `src/app/karepovac/layout.tsx`
- Modify: `src/app/karepovac/financije/page.tsx`
- Modify: `src/app/karepovac/metodologija/page.tsx`
- Modify: `src/app/karepovac/podaci/page.tsx`
- Modify: `src/app/karepovac/postaje/page.tsx`
- Modify: `src/app/karepovac/ukljuci-se/page.tsx`
- Modify: `src/app/prijedlozi/page.tsx`
- Modify: `src/app/prijedlozi/[slug]/page.tsx`
- Modify: `src/app/prijavi/page.tsx`
- Modify: `src/app/plan/page.tsx`
- Modify: `src/app/podaci/page.tsx`
- Modify: `src/app/dokumenti/page.tsx`
- Modify: `src/app/o-inicijativi/page.tsx`
- Create: `src/app/social-metadata.test.ts`

**Interfaces:**
- Consumes: `createPageMetadata`, `publicDescriptionExcerpt`, and approved copy constants.
- Produces: explicit ordinary/Open Graph/Twitter title and description on every public route.

- [ ] **Step 1: Write route-copy tests**

Assert the approved main-journey titles and descriptions, verify every public
static metadata declaration uses `createPageMetadata`, and exercise the dynamic
proposal metadata with a public description fixture.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npx tsx --test src/app/social-metadata.test.ts`

Expected: failure because public pages still export partial metadata.

- [ ] **Step 3: Migrate static public routes**

Replace direct `Metadata` objects with `createPageMetadata`. Keep current
descriptions where the spec says to retain them; use the approved homepage,
map, Karepovac, Problems, submission, documents, and initiative text verbatim.

- [ ] **Step 4: Add safe proposal metadata**

Use the published proposal title and `publicDescriptionExcerpt` result. If the
proposal is absent or description is empty, use `Prijedlog` and the generic
Problems description. Do not pass the proposal object or any moderation field
to the helper.

- [ ] **Step 5: Run all verification gates**

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npm run lint -- --ignore-pattern .worktrees`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Verify generated head tags and image locally**

Start the production server, request `/`, `/karta`, `/karepovac`,
`/prijedlozi`, and one proposal with `facebookexternalhit/1.1`, and confirm the
approved `og:*` and `twitter:*` values. Fetch the emitted image URL and confirm
HTTP 200 plus `content-type: image/png`.

- [ ] **Step 7: Commit, push, deploy, and repeat crawler checks in production**

Commit message: `feat: add social share metadata`

Deploy the exact commit to production and repeat representative crawler and
image checks against `https://kvart-sage.vercel.app`.
