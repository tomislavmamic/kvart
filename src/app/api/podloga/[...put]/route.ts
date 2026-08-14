import { NextResponse } from "next/server";
import {
  adresaIzvora,
  podlogaZaPosluzivanje,
  uMrezi,
  uObuhvatu,
  zaglavljaGreske,
  zaglavljaPlocice,
} from "@/lib/plocice";

/**
 * Podloga preko nas, s predmemorijom na rubu mreže.
 *
 * `/api/podloga/{id}/{z}/{x}/{y}` — obična XYZ pločica. Ruta je prevede u
 * WMS GetMap prema DGU-u, sliku vrati i pusti je da se zapamti.
 *
 * Razlog je izmjeren: geoportal pojedinačnu pločicu isporuči za 0,4 s, ali
 * osam njih odjednom troši oko 4 s, i to plaća svaki posjetitelj pri svakom
 * pomaku karte. Kvart je 3 × 2 km i svi gledaju isto, pa prvi posjetitelj
 * plati dohvat, a svi ostali dobiju pločicu iz predmemorije.
 *
 * Adresa je namjerno bez upitnika: rub mreže pamti po punom putu, pa
 * `{z}/{x}/{y}` u stazi daje jedan zapis po pločici. Ista slika zatražena
 * kroz upitnik s promjenjivim redoslijedom parametara bila bi više zapisa.
 *
 * OGRADE — ovo ne smije postati otvoreni posrednik prema DGU-u:
 *   1. `id` mora biti WMS podloga iz registra; ništa drugo se ne poslužuje.
 *   2. `z/x/y` moraju biti cijeli brojevi unutar mreže i unutar z11–18.
 *   3. Pločica mora dodirivati obuhvat karte (MAP_MAX_BOUNDS).
 * Bez treće bi ruta posluživala cijelu državu, tuđim servisom a pod našim
 * imenom i na naš račun.
 */

/** Dohvat je uvijek živ; pamćenje radi rub mreže preko Cache-Control. */
export const dynamic = "force-dynamic";

/** Ako geoportal ne odgovori u ovome, pločica se odustaje. */
const ROK_MS = 20_000;

// Oblik se piše izrijekom umjesto preko `RouteContext<…>`: taj tip nastaje
// tek `next typegen`-om, pa gola `tsc --noEmit` provjera (koju vrti i CI)
// padne ako se gradnja prije toga nije vrtjela.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ put: string[] }> },
): Promise<Response> {
  const { put } = await ctx.params;
  if (!put || put.length !== 4) {
    return NextResponse.json(
      { error: "Očekuje se /api/podloga/{podloga}/{z}/{x}/{y}." },
      { status: 400, headers: zaglavljaGreske() },
    );
  }

  const [id, zTekst, xTekst, yTekst] = put;
  // `.jpg` na kraju je dopušten jer ga neki alati očekuju, ali nije nužan.
  const z = Number(zTekst);
  const x = Number(xTekst);
  const y = Number(yTekst.replace(/\.(jpg|jpeg|png)$/i, ""));

  const base = podlogaZaPosluzivanje(id);
  if (!base) {
    return NextResponse.json(
      { error: "Nepoznata podloga." },
      { status: 404, headers: zaglavljaGreske() },
    );
  }
  if (!uMrezi(z, x, y)) {
    return NextResponse.json(
      { error: "Pločica izvan mreže." },
      { status: 400, headers: zaglavljaGreske() },
    );
  }
  if (!uObuhvatu(z, x, y)) {
    return NextResponse.json(
      { error: "Pločica izvan obuhvata karte." },
      { status: 404, headers: zaglavljaGreske() },
    );
  }

  try {
    const odgovor = await fetch(adresaIzvora(base, z, x, y), {
      headers: { "User-Agent": "nas-kvart-split/1.0" },
      signal: AbortSignal.timeout(ROK_MS),
    });
    if (!odgovor.ok) {
      return NextResponse.json(
        { error: "Izvor podloge trenutno ne odgovara." },
        { status: 502, headers: zaglavljaGreske() },
      );
    }
    // Servis na grešku zna vratiti XML s kodom 200. Takvo tijelo nije slika i
    // ne smije se zapamtiti na godinu dana kao da jest.
    const vrsta = odgovor.headers.get("content-type") ?? "";
    if (!vrsta.startsWith("image/")) {
      return NextResponse.json(
        { error: "Izvor nije vratio sliku." },
        { status: 502, headers: zaglavljaGreske() },
      );
    }
    return new Response(await odgovor.arrayBuffer(), {
      status: 200,
      headers: zaglavljaPlocice(),
    });
  } catch {
    return NextResponse.json(
      { error: "Izvor podloge nije dostupan." },
      { status: 502, headers: zaglavljaGreske() },
    );
  }
}
