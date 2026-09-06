import assert from "node:assert/strict";
import test from "node:test";

import { PRIJEDLOZI_POSTAJA } from "@/lib/sim/prijedlozi-postaja";
import {
  eur,
  NAJDULJE,
  provjeriPonudu,
  trebaStanovnika,
  VRSTE_POMOCI,
} from "./ukljuci-se";

const POZNATE = new Set(PRIJEDLOZI_POSTAJA.map((p) => p.id));

test("postaje se dijele na one koje traže stanovnika i one koje traže ustanovu", () => {
  const stanovnici = PRIJEDLOZI_POSTAJA.filter(trebaStanovnika).map((p) => p.id);
  const ustanove = PRIJEDLOZI_POSTAJA.filter((p) => !trebaStanovnika(p)).map((p) => p.id);

  // Dvorište ili balkon može ponuditi susjed; plohu, ogradu, Zavod i
  // Sveučilište ne može nitko tko čita ovu stranicu.
  for (const id of ["dracevac-7b", "bilice", "kila-mostine", "padina-sz", "znjan"]) {
    assert.ok(stanovnici.includes(id), `${id} traži stanovnika`);
  }
  for (const id of ["ploha-jarbol", "k1-umjeravanje", "ograda-metan", "kampus"]) {
    assert.ok(ustanove.includes(id), `${id} traži ustanovu`);
  }
  assert.equal(stanovnici.length + ustanove.length, PRIJEDLOZI_POSTAJA.length);
});

test("ponuda traži barem jednu vrstu pomoći, i to s popisa", () => {
  const prazno = { vrste: [], postaja: "", podrucje: "", kontakt: "", poruka: "" };
  assert.equal(provjeriPonudu(prazno, POZNATE).ok, false);
  assert.equal(
    provjeriPonudu({ ...prazno, vrste: ["kava"] }, POZNATE).ok,
    false,
  );

  const r = provjeriPonudu({ ...prazno, vrste: ["mjesto", "mjesto", "znanje"] }, POZNATE);
  assert.ok(r.ok);
  // Dvaput označeno ne vrijedi dvaput.
  assert.deepEqual(r.ponuda.vrste, ["mjesto", "znanje"]);
  assert.equal(r.ponuda.postaja, null);
  assert.equal(r.ponuda.kontakt, null);
});

test("postaja mora postojati, a prazna je dopuštena", () => {
  const osnova = { vrste: ["novac"], podrucje: "", kontakt: "", poruka: "" };
  assert.equal(provjeriPonudu({ ...osnova, postaja: "nepostojeca" }, POZNATE).ok, false);

  const s = provjeriPonudu({ ...osnova, postaja: " bilice " }, POZNATE);
  assert.ok(s.ok);
  assert.equal(s.ponuda.postaja, "bilice");

  const bez = provjeriPonudu({ ...osnova, postaja: "" }, POZNATE);
  assert.ok(bez.ok);
  assert.equal(bez.ponuda.postaja, null);
});

test("duljine su ograničene, a prazno je null, ne prazan niz", () => {
  const osnova = { vrste: ["mjesto"], postaja: "", podrucje: "", kontakt: "", poruka: "" };
  assert.equal(
    provjeriPonudu({ ...osnova, kontakt: "x".repeat(NAJDULJE.kontakt + 1) }, POZNATE).ok,
    false,
  );
  assert.equal(
    provjeriPonudu({ ...osnova, podrucje: "x".repeat(NAJDULJE.podrucje + 1) }, POZNATE).ok,
    false,
  );
  assert.equal(
    provjeriPonudu({ ...osnova, poruka: "x".repeat(NAJDULJE.poruka + 1) }, POZNATE).ok,
    false,
  );

  const r = provjeriPonudu(
    { ...osnova, podrucje: "  Dračevac 7B ", kontakt: "   ", poruka: " imam balkon " },
    POZNATE,
  );
  assert.ok(r.ok);
  assert.equal(r.ponuda.podrucje, "Dračevac 7B");
  assert.equal(r.ponuda.kontakt, null);
  assert.equal(r.ponuda.poruka, "imam balkon");
});

test("vrste pomoći nose natpis i opis, i nijedna ne obećava uplatu", () => {
  assert.deepEqual(
    VRSTE_POMOCI.map((v) => v.id),
    ["mjesto", "znanje", "novac"],
  );
  for (const v of VRSTE_POMOCI) {
    assert.ok(v.natpis.length > 0 && v.opis.length > 0);
    assert.doesNotMatch(v.natpis + v.opis, /uplat/i);
  }
  assert.match(VRSTE_POMOCI[2].opis, /bez ikakve obveze/);
});

test("cijena se piše hrvatski, s tisućicom i bez razmaka oko crtice", () => {
  assert.equal(eur(600, 1500), "600–1.500 €");
  assert.equal(eur(4600, 10600), "4.600–10.600 €");
});

test("ponude imaju vlastiti spremnik ograde, odvojen od prijava problema", async () => {
  const { checkRateLimit } = await import("./rate-limit");
  const { OGRADA_PONUDE } = await import("./ukljuci-se");
  const memorija = new Map();
  const ip = "10.0.0.1";
  // Pet tuđih prijava problema iz iste adrese (zadani spremnik)…
  for (let i = 0; i < 5; i += 1) assert.ok(checkRateLimit(ip, { memorija }));
  assert.equal(checkRateLimit(ip, { memorija }), false);
  // …ne zatvaraju susjedu obrazac za pomoć.
  assert.ok(checkRateLimit(ip, { ...OGRADA_PONUDE, memorija }));
  for (let i = 1; i < OGRADA_PONUDE.max; i += 1) {
    assert.ok(checkRateLimit(ip, { ...OGRADA_PONUDE, memorija }));
  }
  assert.equal(checkRateLimit(ip, { ...OGRADA_PONUDE, memorija }), false);
});
