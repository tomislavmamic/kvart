import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the diorama renders recognizable real-scene layers without camera controls", async () => {
  const { KvartDiorama } = await import("./kvart-diorama");
  const markup = renderToStaticMarkup(createElement(KvartDiorama));

  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-labelledby="igra-title igra-description"/);
  assert.match(markup, /data-layer="land"/);
  assert.match(markup, /data-layer="terrain"/);
  assert.match(markup, /data-layer="roads"/);
  assert.match(markup, /data-road-kind="major"/);
  assert.match(markup, /data-road-kind="local"/);
  assert.match(markup, /data-road-kind="minor"/);
  assert.match(markup, /id="igra-land-clip"/);
  assert.match(markup, /clip-path="url\(#igra-land-clip\)"/);
  assert.match(markup, /data-layer="large-buildings"/);
  assert.match(markup, /data-layer="homes"/);
  assert.match(markup, /data-layer="aqueduct"/);
  assert.match(markup, />Dračevac</);
  assert.match(markup, />Bilice</);
  assert.match(markup, />Akvadukt</);
  assert.doesNotMatch(markup, /zoom|pan|wheel|pointermove/i);
});

test("the animation controller exposes an accessible Croatian pause state", async () => {
  const { DioramaControllerView } = await import("./diorama-controller");
  const scene = createElement("div", { id: "scene" });

  const runningMarkup = renderToStaticMarkup(
    createElement(
      DioramaControllerView,
      {
        paused: false,
        onToggle: () => undefined,
      },
      scene,
    ),
  );
  assert.match(runningMarkup, /data-paused="false"/);
  assert.match(runningMarkup, /aria-pressed="false"/);
  assert.match(runningMarkup, />Pauziraj animaciju</);

  const pausedMarkup = renderToStaticMarkup(
    createElement(
      DioramaControllerView,
      {
        paused: true,
        onToggle: () => undefined,
      },
      scene,
    ),
  );
  assert.match(pausedMarkup, /data-paused="true"/);
  assert.match(pausedMarkup, /aria-pressed="true"/);
  assert.match(pausedMarkup, />Pokreni animaciju</);
});
