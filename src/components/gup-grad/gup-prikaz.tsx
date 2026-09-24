"use client";

/**
 * /gup: prekidač između grafikona (infografika.tsx) i karte provjere
 * (gup-karta.tsx). Oba prikaza dijele godinu plana i način brojanja, pa
 * prelazak s jednog na drugi pokazuje isti izračun.
 *
 * Zadani prikaz je karta, preko cijelog prozora; grafikon je
 * `?prikaz=grafikon` (uz njega su tekst i „Kako je izračunato”). Središte i
 * zum karte su u adresi (`c`, `z`), da se mjesto može poslati poveznicom.
 * Karta se učitava zasebno — Leaflet ne treba onome tko gleda grafikon.
 */
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import { GupInfografika, Prekidac, type PodaciInfografike } from "@/components/gup-grad/infografika";
import { POCETNE_GUP_POSTAVKE, type GupPostavke } from "@/components/gup-grad/gup-provjera";

const GupKarta = dynamic(() => import("@/components/gup-grad/gup-karta").then((m) => m.GupKarta), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[1100] animate-pulse bg-zinc-100" />,
});

type Prikaz = "grafikon" | "karta";
const PRIKAZI: { id: Prikaz; naziv: string }[] = [
  { id: "grafikon", naziv: "Grafikon" },
  { id: "karta", naziv: "Karta" },
];

/**
 * Prikaz živi u adresi. Stranica je statična, pa ga poslužitelj ne zna i
 * crta zadani (kartu); preglednik ga pročita iz adrese pri hidraciji.
 * Grafikon je u HTML-u i dok se gleda karta (skriven), pa ga tražilice vide.
 */
const PROMJENA = "gup-prikaz";
function pretplati(javi: () => void) {
  window.addEventListener(PROMJENA, javi);
  window.addEventListener("popstate", javi);
  return () => {
    window.removeEventListener(PROMJENA, javi);
    window.removeEventListener("popstate", javi);
  };
}
const izAdrese = (): Prikaz => (new URLSearchParams(window.location.search).get("prikaz") === "grafikon" ? "grafikon" : "karta");

export function GupPrikaz({ podaci }: { podaci: PodaciInfografike }) {
  const prikaz = useSyncExternalStore(pretplati, izAdrese, () => "karta" as Prikaz);
  const [postavke, setPostavke] = useState<GupPostavke>({ ...POCETNE_GUP_POSTAVKE, inacica: podaci.inacice[0].id });

  const promijeni = (p: Prikaz) => {
    if (p === "grafikon") window.scrollTo(0, 0);
    const u = new URL(window.location.href);
    if (p === "karta") u.searchParams.delete("prikaz");
    else {
      u.searchParams.set("prikaz", "grafikon");
      for (const k of ["c", "z"]) u.searchParams.delete(k);
    }
    window.history.replaceState(window.history.state, "", u);
    window.dispatchEvent(new Event(PROMJENA));
  };

  const prekidac = <Prekidac oznaka="Prikaz" opcije={PRIKAZI} vrijednost={prikaz} promijeni={promijeni} />;
  return (
    <div>
      <div className="flex">{prekidac}</div>
      <div className="mt-4">
        {/* Grafikon ostaje u stablu i dok se gleda karta, da ne izgubi svoje izbore. */}
        <div hidden={prikaz !== "grafikon"}>
          <GupInfografika
            podaci={podaci}
            godina={postavke.godina}
            onGodina={(godina) => setPostavke((p) => ({ ...p, godina }))}
            inacica={postavke.inacica}
            onInacica={(inacica) => setPostavke((p) => ({ ...p, inacica }))}
          />
        </div>
        {prikaz === "karta" && <GupKarta postavke={postavke} onPostavke={setPostavke} prekidac={prekidac} />}
      </div>
    </div>
  );
}
