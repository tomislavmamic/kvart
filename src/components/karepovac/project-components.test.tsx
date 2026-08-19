import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PogledZraka } from "./karta-kartice";

test("perjanica se ne predstavlja kao mjerenje", () => {
  const markup = renderToStaticMarkup(<PogledZraka />);

  for (const izraz of [
    "Model, ne mjerenje",
    "Oblik, ne količina",
    "Polje vjetra",
    "iz LiDAR reljefa",
    "Jačina izvora",
    "bazdarena, ali široko",
  ]) {
    assert.match(markup, new RegExp(izraz), izraz);
  }

  // Ništa na prikazu ne smije nositi oznaku izmjerenog.
  assert.doesNotMatch(markup, /data-kind="measurement"/);
  assert.equal(
    (markup.match(/data-kind="estimated"/g) ?? []).length,
    2,
    "izvedene stavke moraju biti označene kao procjena",
  );
  assert.match(markup, /data-kind="missing"/);
});

test("prizor nosi podlogu, obris plohe i mjerilo", () => {
  const markup = renderToStaticMarkup(<PogledZraka />);

  assert.match(markup, /id="karepovac-podloga"/, "definicija podloge");
  assert.match(markup, /href="#karepovac-podloga"/, "uporaba podloge");
  assert.match(markup, /<canvas/, "platno za perjanicu");
  assert.match(markup, /\/karta\?pogled=zrak-karepovac/, "poveznica na kartu");
  assert.match(markup, /500 m/, "mjerilo");
  assert.match(markup, /Dračevac/, "natpisi mjesta");
  assert.match(markup, /istok-jugoistok/, "prikazano vrijeme");
});

test("platno leži ispod natpisa, da dim ne proguta imena mjesta", () => {
  const markup = renderToStaticMarkup(<PogledZraka />);

  const platno = markup.indexOf("<canvas");
  const natpis = markup.indexOf("Dračevac");
  assert.ok(platno > 0 && natpis > 0, "oba sloja moraju postojati");
  assert.ok(platno < natpis, "natpisi se crtaju nakon platna");
});
