import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  dohvatiZrak,
  PRETPOSTAVLJENO,
  procitajDhmz,
  procitajAzo,
  procitajMijesanje,
  procitajVjetar,
  trenutakIzTermina,
} from "@/lib/vjetar";

const SADA = new Date("2026-08-19T14:20:00Z");

/**
 * Slaže DHMZ-ov izvještaj s pola svojih postaja.
 *
 * Termin je mjesni sat, pa je 16 h ono što u Splitu piše u 14:20 UTC ljeti.
 */
function xml(
  postaje: readonly [string, string, string][],
  termin = 16,
  datum = "19.08.2026",
): string {
  const gradovi = postaje
    .map(
      ([ime, smjer, brzina]) => `<Grad autom="1">
<GradIme>${ime}</GradIme>
<Podatci><Temp> 31.9</Temp><VjetarSmjer>${smjer}</VjetarSmjer>` +
        `<VjetarBrzina>${brzina}</VjetarBrzina></Podatci>
</Grad>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Hrvatska><DatumTermin><Datum>${datum}</Datum><Termin>${termin}</Termin></DatumTermin>
${gradovi}
</Hrvatska>`;
}

/** Zapis kakav vraća aviationweather.gov. */
function opazanje(
  minutaPrije: number,
  wdir: number | string | null,
  wspd: number | null,
) {
  return {
    icaoId: "LDSP",
    obsTime: Math.round(SADA.getTime() / 1000) - minutaPrije * 60,
    wdir,
    wspd,
    rawOb: "METAR LDSP …",
  };
}

test("uzima najnovije opažanje, ne prvo u nizu", () => {
  const vjetar = procitajVjetar(
    [opazanje(80, 110, 6), opazanje(20, 230, 9), opazanje(50, 300, 4)],
    SADA,
  );
  assert.ok(vjetar);
  assert.equal(vjetar.smjerOd, 230);
  assert.ok(
    Math.abs(vjetar.brzina - 9 * 0.514444) < 0.01,
    `čvorovi se moraju pretvoriti u m/s, a dobili smo ${vjetar.brzina}`,
  );
  assert.equal(vjetar.opazeno, "2026-08-19T14:00:00.000Z");
});

test("prestaro opažanje ne opisuje sadašnjost", () => {
  assert.equal(procitajVjetar([opazanje(4 * 60, 110, 6)], SADA), null);
});

test("tišina se prepoznaje, i smjer tada ništa ne tvrdi", () => {
  const vjetar = procitajVjetar([opazanje(5, 0, 0)], SADA);
  assert.ok(vjetar);
  assert.equal(vjetar.brzina, 0);
  assert.equal(vjetar.tisina, true);
});

test("promjenjiv smjer (VRB) se ne pretvara u stupnjeve", () => {
  const vjetar = procitajVjetar([opazanje(5, "VRB", 3)], SADA);
  assert.ok(vjetar);
  assert.equal(vjetar.promjenjiv, true);
});

test("odgovor koji nije niz ili nema brzinu daje ništa", () => {
  assert.equal(procitajVjetar(null, SADA), null);
  assert.equal(procitajVjetar({ greska: "nema" }, SADA), null);
  assert.equal(procitajVjetar([opazanje(5, 110, null)], SADA), null);
});

test("dubina sloja se uzima iz sata najbližeg sadašnjosti", () => {
  const mijesanje = procitajMijesanje(
    {
      hourly: {
        time: ["2026-08-19T13:00", "2026-08-19T14:00", "2026-08-19T15:00"],
        boundary_layer_height: [610, 410, 300],
      },
    },
    SADA,
  );
  assert.ok(mijesanje);
  assert.equal(mijesanje.dubina, 410);
  assert.equal(mijesanje.vrijeme, "2026-08-19T14:00Z");
});

test("noćni sloj se ne prikazuje tanjim nego što ga model umije razlučiti", () => {
  const mijesanje = procitajMijesanje(
    {
      hourly: {
        time: ["2026-08-19T14:00"],
        boundary_layer_height: [15],
      },
    },
    SADA,
  );
  assert.ok(mijesanje);
  assert.equal(mijesanje.dubina, 25);
});

test("stari ili manjkav niz satova daje ništa", () => {
  assert.equal(
    procitajMijesanje(
      { hourly: { time: ["2026-08-18T02:00"], boundary_layer_height: [200] } },
      SADA,
    ),
    null,
  );
  assert.equal(procitajMijesanje({ hourly: { time: [] } }, SADA), null);
  assert.equal(procitajMijesanje("ne valja", SADA), null);
});

/** Satni niz kakav vraća AZO-ova baza. */
function azo(sati: readonly [number, number][]): unknown {
  return sati.map(([minutaPrije, vrijednost]) => ({
    vrijednost,
    mjernaJedinica: "m/s",
    vrijeme: SADA.getTime() - minutaPrije * 60 * 1000,
  }));
}

type AzoPostaja = { brzina: unknown; smjer: unknown } | null;

/** Odgovara kao svi izvori odjednom; AZO se razlikuje po oznaci postaje. */
function posluzi(
  t: TestContext,
  {
    dhmz,
    split3 = null,
    split2 = null,
  }: { dhmz: string; split3?: AzoPostaja; split2?: AzoPostaja },
): string[] {
  const zvano: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, opcije: RequestInit) => {
    zvano.push(url);
    // Zaglavlja moraju proći platformsku provjeru: jedno slovo s kvačicom u
    // `user-agent` sruši poziv prije nego što ode, a `catch` bi to progutao.
    new Headers(opcije.headers);
    if (url.includes("vrijeme.hr")) {
      return new Response(dhmz, { headers: { "content-type": "text/xml" } });
    }
    let tijelo: unknown;
    if (url.includes("iszz.azo.hr")) {
      const postaja = url.includes("postaja=305") ? split3 : split2;
      tijelo = postaja
        ? url.includes("polutant=477")
          ? postaja.brzina
          : postaja.smjer
        : [];
    } else if (url.includes("aviationweather")) {
      tijelo = [opazanje(10, 112, 4)];
    } else {
      tijelo = { hourly: { time: ["2026-08-19T14:00"], boundary_layer_height: [140] } };
    }
    return new Response(JSON.stringify(tijelo), {
      headers: { "content-type": "application/json" },
    });
  });
  return zvano;
}

test("dohvat zove sve izvore i sastavlja stanje", async (t) => {
  const zvano = posluzi(t, { dhmz: xml([["Split-Marjan", "-", "-"]]) });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zvano.length, 7, "sve postaje i sloj miješanja moraju biti pitani");
  assert.equal(zrak.izvor, "uzivo");
  assert.equal(zrak.vjetar?.postaja, "ldsp", "bez DHMZ-ova vjetra ostaje METAR");
  assert.equal(zrak.stanje.smjerOd, 112);
  assert.equal(zrak.stanje.dubina, 140);
  assert.ok(Math.abs(zrak.stanje.brzina - 4 * 0.514444) < 0.01);
});

test("bliža postaja preuzima čim javi vjetar", async (t) => {
  posluzi(t, { dhmz: xml([["Split-Marjan", "SE", "1.8"]]) });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "marjan");
  assert.equal(zrak.stanje.smjerOd, 135);
  assert.equal(zrak.stanje.brzina, 1.8);
});

test("AZO-ova gradska postaja ima prednost pred Marjanom i zračnom lukom", async (t) => {
  posluzi(t, {
    dhmz: xml([["Split-Marjan", "SW", "2"]]),
    split3: { brzina: azo([[80, 1.9], [20, 1.7]]), smjer: azo([[80, 240], [20, 235.2]]) },
  });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "split3");
  assert.equal(zrak.stanje.brzina, 1.7);
  assert.equal(zrak.stanje.smjerOd, 235.2);
  assert.deepEqual(
    zrak.ocitanja.map((o) => o.postaja),
    ["split3", "marjan", "ldsp"],
    "ostala očitanja se čuvaju za usporedbu, i ona koja ne vode",
  );
});

test("brzina bez smjera u istom satu ne postaje smjer iz drugog sata", () => {
  const ocitanje = procitajAzo(
    "split3",
    azo([[80, 1.9], [20, 1.7]]),
    azo([[80, 240]]),
    SADA,
  );
  assert.equal(ocitanje?.brzina, 1.7);
  assert.equal(ocitanje?.promjenjiv, true, "smjer za taj sat nije stigao");
});

test("prestaro AZO-ovo očitanje se odbacuje", () => {
  assert.equal(procitajAzo("split2", azo([[400, 2]]), azo([[400, 100]]), SADA), null);
  assert.equal(procitajAzo("split2", [], [], SADA), null);
  assert.equal(procitajAzo("split2", null, null, SADA), null);
});

test("kad izvor padne, stanje se vraća na pretpostavku", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("mreža");
  });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.izvor, "pretpostavka");
  assert.equal(zrak.vjetar, null);
  assert.deepEqual(zrak.stanje, PRETPOSTAVLJENO);
});

test("izvor koji vrati grešku ne prolazi kao podatak", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("gužva", { status: 503 }));

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.izvor, "pretpostavka");
});

test("mjesni termin se pretvara u trenutak bez računanja ljetnog vremena", () => {
  const kad = trenutakIzTermina("19.08.2026", 16, SADA);
  assert.ok(kad);
  assert.equal(kad.toISOString(), "2026-08-19T14:00:00.000Z");

  assert.equal(
    trenutakIzTermina("01.01.2020", 12, SADA),
    null,
    "termin od prije dva dana ne postoji u prozoru",
  );
});

test("DHMZ: uzima se najbliža postaja koja je javila brzinu", () => {
  const oba = procitajDhmz(
    xml([
      ["Split-Marjan", "SE", "1.8"],
      ["Split-aerodrom", "SW", "5"],
    ]),
    SADA,
  );
  assert.equal(oba?.postaja, "marjan");
  assert.equal(oba?.smjerOd, 135);

  const bezMarjana = procitajDhmz(
    xml([
      ["Split-Marjan", "-", "-"],
      ["Split-aerodrom", "SW", "5"],
    ]),
    SADA,
  );
  assert.equal(bezMarjana?.postaja, "aerodrom");
  assert.equal(bezMarjana?.smjerOd, 225);
  assert.equal(bezMarjana?.brzina, 5);
});

test("DHMZ: crtica znači da podatka nema, ne da nema vjetra", () => {
  const nista = procitajDhmz(
    xml([
      ["Split-Marjan", "-", "-"],
      ["Split-aerodrom", "-", "-"],
    ]),
    SADA,
  );
  assert.equal(nista, null, "prazne postaje moraju pustiti METAR naprijed");
});

test("DHMZ: tišina i nepoznat smjer se razlikuju od nedostatka", () => {
  const tiho = procitajDhmz(xml([["Split-Marjan", "C", "0"]]), SADA);
  assert.equal(tiho?.tisina, true);
  assert.equal(tiho?.promjenjiv, true, "„C” nije jedan od osam smjerova");
});

test("DHMZ: stari izvještaj se odbacuje", () => {
  assert.equal(procitajDhmz(xml([["Split-Marjan", "SE", "2"]], 9), SADA), null);
  assert.equal(procitajDhmz("nije xml", SADA), null);
  assert.equal(procitajDhmz(null, SADA), null);
});

test("Marjan ima prednost pred Splitom-2, iako je dalje", async (t) => {
  // Redoslijed ide po tome što je prošlo provjeru na arhivi, ne samo po
  // kilometrima: na noćnim satima Split-2 je bio slabiji od Marjana.
  posluzi(t, {
    dhmz: xml([["Split-Marjan", "NW", "3"]]),
    split2: { brzina: azo([[20, 1.5]]), smjer: azo([[20, 174]]) },
  });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "marjan");
  assert.equal(zrak.stanje.brzina, 3);
  assert.ok(
    zrak.ocitanja.some((o) => o.postaja === "split2"),
    "Split-2 ostaje u očitanjima, samo ne vodi",
  );
});

test("zračna luka vodi tek kad sve bliže postaje šute", async (t) => {
  posluzi(t, { dhmz: xml([["Split-Marjan", "-", "-"]]) });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "ldsp");
});
