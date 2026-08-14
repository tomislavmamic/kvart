/**
 * Oblik reljefnog nalaza — dijele ga poslužitelj i preglednik.
 *
 * Stoji odvojeno od src/lib/reljef.ts iz istog razloga kao dosje-oblik.ts:
 * onaj modul čita datoteke i time povlači `fs` i `zlib`, a preglednik treba
 * samo oblik i natpise.
 */

/** Strana svijeta u koju teren pada. */
export type Strana = "S" | "SI" | "I" | "JI" | "J" | "JZ" | "Z" | "SZ";

export const STRANA_NATPIS: Record<Strana, string> = {
  S: "sjever",
  SI: "sjeveroistok",
  I: "istok",
  JI: "jugoistok",
  J: "jug",
  JZ: "jugozapad",
  Z: "zapad",
  SZ: "sjeverozapad",
};

/**
 * Što reljef kaže o jednom mjestu.
 *
 * `ekspozicija` je `null` na ravnom: strana svijeta u koju pada teren bez
 * pada ne postoji, a najbliži smjer izračunat iz šuma bio bi izmišljotina.
 * Prag je NAGIB_BEZ_STRANE u reljef.ts.
 */
export interface Teren {
  /** Nadmorska visina u metrima, zaokružena na decimetar. */
  visina: number;
  /** Nagib u postocima (visinska razlika kroz vodoravnu udaljenost). */
  nagib: number;
  /** Strana svijeta u koju teren pada; `null` na ravnom. */
  ekspozicija: Strana | null;
  /**
   * Raspon visina preko cijele čestice. `null` kad je klik pao izvan
   * katastra, jer tada nema plohe preko koje bi se raspon mjerio.
   */
  cestica: { najniza: number; najvisa: number } | null;
}
