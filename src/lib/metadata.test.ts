import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHARE_DESCRIPTION,
  PROBLEMS_SHARE_DESCRIPTION,
  SITE_URL,
  createPageMetadata,
  publicDescriptionExcerpt,
} from "./metadata";

test("page metadata carries the browser, Open Graph, and Twitter copy", () => {
  const metadata = createPageMetadata({
    title: "Karta kvarta",
    description: "Istraži kvart.",
  });

  assert.equal(metadata.title, "Karta kvarta");
  assert.deepEqual(metadata.openGraph, {
    type: "website",
    locale: "hr_HR",
    siteName: "Naš kvart — Dračevac i Bilice",
    title: "Karta kvarta — Naš kvart",
    description: "Istraži kvart.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Zračna snimka Dračevca i Bilica s nazivom Naš kvart",
        type: "image/png",
      },
    ],
  });
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image",
    title: "Karta kvarta — Naš kvart",
    description: "Istraži kvart.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "Zračna snimka Dračevca i Bilica s nazivom Naš kvart",
      },
    ],
  });
});

test("the complete site name is not suffixed twice", () => {
  const metadata = createPageMetadata({
    title: "Naš kvart — Dračevac i Bilice",
    description: DEFAULT_SHARE_DESCRIPTION,
  });

  assert.equal(metadata.openGraph?.title, "Naš kvart — Dračevac i Bilice");
});

test("public proposal excerpts collapse whitespace and fall back", () => {
  assert.equal(
    publicDescriptionExcerpt("  Prvi   red\nDrugi red  ", "x"),
    "Prvi red Drugi red",
  );
  assert.equal(publicDescriptionExcerpt(" \n "), PROBLEMS_SHARE_DESCRIPTION);
  assert.equal(publicDescriptionExcerpt(undefined, "Rezerva"), "Rezerva");
});

test("public proposal excerpts truncate on a Unicode-safe word boundary", () => {
  const description = `${"Čestica ".repeat(30)}završetak`;
  const excerpt = publicDescriptionExcerpt(description);

  assert.ok(Array.from(excerpt).length <= 160);
  assert.match(excerpt, /…$/u);
  assert.doesNotMatch(excerpt, /Čest…$/u);
  assert.equal(excerpt.includes("�"), false);
});

test("share constants describe the production site", () => {
  assert.equal(SITE_URL.href, "https://dracevac.vercel.app/");
  assert.match(DEFAULT_SHARE_DESCRIPTION, /Razgovaraj sa susjedima/u);
  assert.equal(
    PROBLEMS_SHARE_DESCRIPTION,
    "Pregledaj što su susjedi prijavili, što je poslano Gradu i dokle je stiglo rješavanje.",
  );
});
