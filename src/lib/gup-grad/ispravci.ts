/**
 * Prijedlozi ispravka karte provjere GUP-a: što posjetitelj smije predložiti
 * i provjera unosa. Isto drže obrazac u skočnom prozoru karte i poslužitelj
 * (src/lib/actions/gup.ts); tablica je `gup_ispravci` (src/lib/db/schema.ts).
 *
 * Vrste su iste kao u ručnom pregledu ortofotom (RucnaVrsta u izracun.ts),
 * pa se prihvaćeni prijedlog primjenjuje bez prevođenja; „ulica” je
 * `promet`, a „drugo” traži napomenu i čeka ručnu odluku.
 */
import type { RucnaVrsta } from "./izracun";

export const VRSTE_ISPRAVKA = {
  izgradjeno: "stoji zgrada koje nema u podacima",
  gradiliste: "gradilište",
  parkiraliste: "parkiralište ili garaže",
  promet: "cesta, put, prilaz",
  zelenilo: "uređeni park ili zelenilo",
  uredjeno: "igralište, šport, trg",
  javna: "škola, vrtić, crkva, bolnica",
  infrastruktura: "trafostanica, vodosprema, benzinska…",
  neizgradivo: "ne može se graditi (stijena, strmina, bujica)",
  slobodno: "doista neizgrađeno, slobodno",
  drugo: "drugo (opiši u napomeni)",
} as const satisfies Partial<Record<RucnaVrsta | "drugo", string>>;

export type VrstaIspravka = keyof typeof VRSTE_ISPRAVKA;

export const STATUSI_ISPRAVKA = ["novo", "prihvaceno", "odbijeno"] as const;
export type StatusIspravka = (typeof STATUSI_ISPRAVKA)[number];

/** Najviše prijedloga s jedne adrese na sat. */
export const OGRADA_ISPRAVKA = { bucket: "gup-ispravak", max: 30 } as const;
export const NAJDULJA_NAPOMENA = 500;

export interface Ispravak {
  ko: string;
  kc: string;
  godina: number;
  stanje: string | null;
  namjena: string | null;
  vrsta: VrstaIspravka;
  napomena: string | null;
  lat: number | null;
  lng: number | null;
}

const broj = (v: unknown) => {
  const x = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};
const tekst = (v: unknown, n: number) => {
  const x = typeof v === "string" ? v.trim().slice(0, n) : "";
  return x || null;
};

export function provjeriIspravak(
  u: Record<string, unknown>,
): { ok: true; ispravak: Ispravak } | { ok: false; error: string } {
  const ko = tekst(u.ko, 60);
  const kc = tekst(u.kc, 30);
  const godina = broj(u.godina);
  if (!ko || !kc || !godina || ![2006, 2015, 2025].includes(godina)) {
    return { ok: false, error: "Nedostaje čestica ili godina plana." };
  }
  const vrsta = String(u.vrsta ?? "");
  if (!(vrsta in VRSTE_ISPRAVKA)) return { ok: false, error: "Odaberite što na čestici stvarno jest." };
  const napomena = tekst(u.napomena, NAJDULJA_NAPOMENA);
  if (vrsta === "drugo" && !napomena) return { ok: false, error: "Za „drugo” opišite u napomeni što je na čestici." };
  const lat = broj(u.lat);
  const lng = broj(u.lng);
  const uSplitu = lat !== null && lng !== null && lat > 43.4 && lat < 43.6 && lng > 16.3 && lng < 16.6;
  return {
    ok: true,
    ispravak: {
      ko,
      kc,
      godina,
      stanje: tekst(u.stanje, 40),
      namjena: tekst(u.namjena, 20),
      vrsta: vrsta as VrstaIspravka,
      napomena,
      lat: uSplitu ? lat : null,
      lng: uSplitu ? lng : null,
    },
  };
}
