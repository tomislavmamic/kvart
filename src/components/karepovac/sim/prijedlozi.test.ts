import assert from "node:assert/strict";
import test from "node:test";

import type { Map as MapaLibre, Marker } from "maplibre-gl";

import { PRIJEDLOZI_POSTAJA } from "@/lib/sim/prijedlozi-postaja";
import { stvoriPrijedloge } from "./prijedlozi";

/**
 * Područje se vidi samo dok je kartica otvorena.
 *
 * Devet isječaka odjednom prekrilo bi pola karte, pa je pravilo strogo: jedan
 * odabran prijedlog daje jedan lik, sve ostalo daje prazno. Ovdje se to
 * provjerava na lažnoj karti, jer prava traži WebGL.
 */

type Zapis = { likova: number; kadar: [[number, number], [number, number]] | null };

/** Najmanji `document` koji oznakama treba; test se vrti bez preglednika. */
function postaviDokument(): () => void {
  const stari = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      type: "",
      className: "",
      innerHTML: "",
      style: {} as Record<string, string>,
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: () => {},
    }),
  };
  return () => {
    (globalThis as { document?: unknown }).document = stari;
  };
}

function lazna(): { karta: MapaLibre; zadnje: Zapis; MarkerRazred: typeof Marker } {
  const zadnje: Zapis = { likova: -1, kadar: null };
  const izvori = new Map<string, { setData(d: { features: unknown[] }): void }>();
  const slojevi = new Set<string>();
  const karta = {
    // Kadar je namjerno malen: tako se vidi da otvoreni prijedlog povuče kartu.
    getBounds: () => ({
      getWest: () => 16.51,
      getSouth: () => 43.52,
      getEast: () => 16.512,
      getNorth: () => 43.522,
    }),
    fitBounds: (o: [[number, number], [number, number]]) => {
      zadnje.kadar = o;
    },
    getSource: (id: string) => izvori.get(id),
    addSource: (id: string) => {
      izvori.set(id, { setData: (d) => (zadnje.likova = d.features.length) });
    },
    getLayer: (id: string) => (slojevi.has(id) ? { id } : undefined),
    addLayer: (s: { id: string }) => slojevi.add(s.id),
    removeLayer: (id: string) => slojevi.delete(id),
    removeSource: (id: string) => izvori.delete(id),
  } as unknown as MapaLibre;
  class LazniMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  return { karta, zadnje, MarkerRazred: LazniMarker as unknown as typeof Marker };
}

test("područje se crta samo za otvoreni prijedlog", (t) => {
  const vrati = postaviDokument();
  t.after?.(vrati);
  const { karta, zadnje, MarkerRazred } = lazna();
  const p = stvoriPrijedloge(karta, MarkerRazred, () => {});

  p.istakni(PRIJEDLOZI_POSTAJA[0].id);
  assert.equal(zadnje.likova, 1, "otvoreni prijedlog nema lik");

  p.istakni(PRIJEDLOZI_POSTAJA[3].id);
  assert.equal(zadnje.likova, 1, "drugi prijedlog mora zamijeniti prvi, ne dodati se");

  p.istakni(null);
  assert.equal(zadnje.likova, 0, "zatvorena kartica ostavila je područje na karti");
});

test("otvoreni prijedlog izvan kadra povuče kartu na sebe", (t) => {
  const vrati = postaviDokument();
  t.after?.(vrati);
  const { karta, zadnje, MarkerRazred } = lazna();
  const p = stvoriPrijedloge(karta, MarkerRazred, () => {});

  const kampus = PRIJEDLOZI_POSTAJA.find((x) => x.id === "kampus");
  assert.ok(kampus);
  p.istakni(kampus.id);
  assert.ok(zadnje.kadar, "kartu nije pomaknuo na područje izvan kadra");
  assert.ok(zadnje.kadar[0][0] < 16.48, "kadar ne obuhvaća kampus");
});

test("ugašeni prijedlozi ne ostavljaju područje za sobom", (t) => {
  const vrati = postaviDokument();
  t.after?.(vrati);
  const { karta, zadnje, MarkerRazred } = lazna();
  const p = stvoriPrijedloge(karta, MarkerRazred, () => {});

  p.istakni(PRIJEDLOZI_POSTAJA[0].id);
  p.vidljivost(false);
  assert.equal(zadnje.likova, 0);

  p.vidljivost(true);
  assert.equal(zadnje.likova, 1, "ponovno paljenje vraća područje otvorenog prijedloga");
});
