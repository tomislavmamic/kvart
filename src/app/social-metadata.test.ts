import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  PROBLEMS_SHARE_DESCRIPTION,
  createProposalMetadata,
} from "../lib/metadata";

const publicMetadataFiles = [
  "karta/page.tsx",
  "karepovac/layout.tsx",
  "karepovac/financije/page.tsx",
  "karepovac/metodologija/page.tsx",
  "karepovac/podaci/page.tsx",
  "karepovac/postaje/page.tsx",
  "karepovac/ukljuci-se/page.tsx",
  "prijedlozi/page.tsx",
  "prijavi/page.tsx",
  "plan/page.tsx",
  "podaci/page.tsx",
  "dokumenti/page.tsx",
  "o-inicijativi/page.tsx",
] as const;

test("every public static route explicitly constructs social metadata", async () => {
  for (const relativePath of publicMetadataFiles) {
    const source = await readFile(join(process.cwd(), "src", "app", relativePath), "utf8");
    assert.match(source, /createPageMetadata\(\{/u, relativePath);
  }
});

test("the main public journeys use the approved share copy", async () => {
  const expectations = new Map([
    [
      "karta/page.tsx",
      "Istraži prostorne planove, katastarske čestice, javne površine i infrastrukturu Dračevca i Bilica.",
    ],
    [
      "karepovac/layout.tsx",
      "Pratite pripremu mjernih postaja, metodologiju, podatke i načine uključivanja.",
    ],
    [
      "prijavi/page.tsx",
      "Prijavi problem u Dračevcu ili Bilicama bez registracije. Prijavu pregledavamo prije javne objave.",
    ],
  ]);

  for (const [relativePath, description] of expectations) {
    const source = await readFile(join(process.cwd(), "src", "app", relativePath), "utf8");
    assert.ok(source.includes(description), relativePath);
  }

  const problemsSource = await readFile(
    join(process.cwd(), "src", "app", "prijedlozi/page.tsx"),
    "utf8",
  );
  assert.match(problemsSource, /description: PROBLEMS_SHARE_DESCRIPTION/u);
});

test("proposal metadata uses only a public title and safe description excerpt", () => {
  const metadata = createProposalMetadata({
    title: "Sigurniji prijelaz",
    description: `  ${"Dugačak opis čestice ".repeat(20)}  `,
  });

  assert.equal(metadata.title, "Sigurniji prijelaz");
  assert.equal(metadata.openGraph?.title, "Sigurniji prijelaz — Naš kvart");
  assert.ok(Array.from(String(metadata.openGraph?.description)).length <= 160);

  const fallback = createProposalMetadata(null);
  assert.equal(fallback.title, "Prijedlog");
  assert.equal(fallback.openGraph?.description, PROBLEMS_SHARE_DESCRIPTION);
});
