import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { MonitoringField } from "./project-components";

test("monitoring field previews future measurements without presenting them as real", () => {
  const markup = renderToStaticMarkup(<MonitoringField />);

  for (const phrase of [
    "Ogledni podaci",
    "Nisu stvarna mjerenja",
    "Postaja A",
    "Postaja B",
    "Postaja C",
    "1,8 ppb",
    "4,2 ppb",
    "2,6 ppb",
    "Vjetar",
    "SZ · 3,2 m/s",
    "Procjena prema vjetru",
    "Prema jugoistoku",
  ]) {
    assert.match(markup, new RegExp(phrase), phrase);
  }

  assert.match(markup, /data-preview="true"/);
  assert.ok(
    (markup.match(/data-kind="measurement"/g) ?? []).length >= 3,
    "each station preview should be marked as a measurement",
  );
  assert.equal(
    (markup.match(/data-kind="estimated"/g) ?? []).length,
    1,
    "wind estimate should be marked exactly once",
  );
});
