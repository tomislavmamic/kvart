import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PRETPOSTAVLJENO, type ZrakSada } from "@/lib/vjetar";
import { slozi } from "@/lib/zrak";
import { PrikazPoljaDima } from "./karta-kartice";

/** Stanje kakvo dođe kad oba izvora odgovore. */
const JUGO: ZrakSada = {
  stanje: { smjerOd: 112, brzina: 1.4, dubina: 60 },
  vjetar: {
    postaja: "ldsp",
    smjerOd: 112,
    brzina: 1.4,
    tisina: false,
    promjenjiv: false,
    opazeno: "2026-08-19T20:30:00.000Z",
  },
  mijesanje: { dubina: 60, vrijeme: "2026-08-19T20:00Z" },
  izvor: "uzivo",
  ocitanja: [],
};

/** Vjetra nema — zrak s plohe ne odlazi nikamo. */
const TISINA: ZrakSada = {
  stanje: { smjerOd: 112, brzina: 0.2, dubina: 25 },
  vjetar: {
    postaja: "marjan",
    smjerOd: 112,
    brzina: 0.2,
    tisina: true,
    promjenjiv: false,
    opazeno: "2026-08-19T02:30:00.000Z",
  },
  mijesanje: { dubina: 25, vrijeme: "2026-08-19T02:00Z" },
  izvor: "uzivo",
  ocitanja: [],
};

/** Oba izvora šute. */
const BEZ_IZVORA: ZrakSada = {
  stanje: PRETPOSTAVLJENO,
  vjetar: null,
  ocitanja: [],
  mijesanje: null,
  izvor: "pretpostavka",
};

function nacrtaj(zrak: ZrakSada): string {
  return renderToStaticMarkup(<PrikazPoljaDima {...slozi(zrak)} />);
}

test("perjanica se ne predstavlja kao mjerenje", () => {
  const markup = nacrtaj(JUGO);

  for (const izraz of [
    "Model, ne mjerenje",
    "Mjerenja još nisu počela",
    "Jačina izvora",
    "još ne znamo",
  ]) {
    assert.match(markup, new RegExp(izraz), izraz);
  }

  // Ništa na prikazu ne smije nositi oznaku izmjerenog plina; jedino izmjereno
  // ovdje je vjetar, i to na zračnoj luci.
  assert.doesNotMatch(markup, /data-kind="measurement"/);
  assert.match(markup, /data-kind="official"/);
  assert.match(markup, /data-kind="estimated"/);
  assert.match(markup, /data-kind="missing"/);
});

test("prikaz nikad ne tvrdi koliko mirisa ima", () => {
  for (const zrak of [JUGO, TISINA, BEZ_IZVORA]) {
    const markup = nacrtaj(zrak);
    for (const zabranjeno of [
      "µg",
      "ppb",
      "granic",
      "opasn",
      "sigurno je",
      "ouE",
    ]) {
      assert.doesNotMatch(
        markup,
        new RegExp(zabranjeno, "i"),
        `${zabranjeno} u stanju ${zrak.izvor}`,
      );
    }
  }
});

test("tišina se vidi kao tišina, a ne kao perjanica prema kvartu", () => {
  const markup = nacrtaj(TISINA);
  assert.match(markup, /tišina/i);
  assert.match(markup, /zadržava/, "mora reći da zrak stoji");
  assert.doesNotMatch(markup, /prema kvartu/);
  assert.doesNotMatch(
    markup,
    /os \d+°/,
    "bez vjetra nema osi nošenja, pa je ni ne pišemo",
  );
});

test("kad izvori šute, stranica to piše umjesto da izmišlja sadašnjost", () => {
  const markup = nacrtaj(BEZ_IZVORA);
  assert.match(markup, /ne možemo dohvatiti/);
  assert.match(markup, /sada nedostupan/);
  assert.match(markup, /sada nedostupno/);
});

test("prizor nosi podlogu, obris plohe i mjerilo", () => {
  const markup = nacrtaj(JUGO);

  assert.match(markup, /id="karepovac-podloga"/, "definicija podloge");
  assert.match(markup, /href="#karepovac-podloga"/, "uporaba podloge");
  assert.match(markup, /<canvas/, "platno za perjanicu");
  assert.match(markup, /500 m/, "mjerilo");
  assert.match(markup, /Dračevac/, "natpisi mjesta");
  assert.match(markup, /levant 112°/, "prikazano vrijeme");
});

test("platno leži ispod natpisa, da dim ne proguta imena mjesta", () => {
  const markup = nacrtaj(JUGO);

  const platno = markup.indexOf("<canvas");
  const natpis = markup.indexOf("Dračevac");
  assert.ok(platno > 0 && natpis > 0, "oba sloja moraju postojati");
  assert.ok(platno < natpis, "natpisi se crtaju nakon platna");
});
