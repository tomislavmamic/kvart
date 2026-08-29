import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  dohvatiZrak,
  PRETPOSTAVLJENO,
  procitajDhmz,
  procitajAzo,
  procitajMijesanje,
  procitajNeverin,
  procitajVjetar,
  trenutakIzTermina,
  trenutakNeverina,
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

/**
 * Odgovor Neverinova naslijeđenog API-ja, svučen na ono što se čita.
 *
 * Vrijeme je mjesno (Europe/Zagreb), kako ga API i piše; 16:10 je ono što u
 * Splitu piše u 14:10 UTC ljeti.
 */
function neverinski(
  datetime = "2026-08-19 16:10:00",
  wavg: number | null = 0.6,
  wdir: number | null = 111,
) {
  return {
    status: "success",
    data: {
      last: { datetime, temp: 31, wspeed: null, wgust: 2.6, wavg, wdir },
      station: { name: "Split-Vrboran", source: "Neverin", source_url: "https://www.neverin.hr" },
    },
  };
}

/** Odgovara kao svi izvori odjednom; AZO se razlikuje po oznaci postaje. */
function posluzi(
  t: TestContext,
  {
    dhmz,
    split3 = null,
    split2 = null,
    neverin = {},
  }: {
    dhmz: string;
    split3?: AzoPostaja;
    split2?: AzoPostaja;
    neverin?: Record<string, unknown>;
  },
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
    } else if (url.includes("api.neverin.hr")) {
      const oznaka = url.split("station=")[1];
      // Postaja bez zadanog odgovora šuti kao da je pala — ništa u `data`.
      tijelo = neverin[oznaka] ?? { status: "error", data: null };
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
  assert.equal(zvano.length, 11, "sve postaje i sloj miješanja moraju biti pitani");
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

test("Neverin: mjesni zapis vremena postaje trenutak, i ljeti i zimi", () => {
  assert.equal(
    trenutakNeverina("2026-08-19 16:10:00")?.toISOString(),
    "2026-08-19T14:10:00.000Z",
  );
  assert.equal(
    trenutakNeverina("2026-01-19 16:10:00")?.toISOString(),
    "2026-01-19T15:10:00.000Z",
  );
  assert.equal(trenutakNeverina("prekjučer"), null);
});

test("Neverin: svježe očitanje se čita, wavg je brzina", () => {
  const v = procitajNeverin("vrboran", neverinski(), SADA);
  assert.equal(v?.postaja, "vrboran");
  assert.equal(v?.brzina, 0.6);
  assert.equal(v?.smjerOd, 111);
  assert.equal(v?.naleti, 2.6);
  assert.equal(v?.opazeno, "2026-08-19T14:10:00.000Z");
});

test("Neverin: postaja koja je prestala javljati otpada na starosti", () => {
  // Žrnovnica ovako stvarno stoji: zadnji zapis 2. 2. 2025.
  const v = procitajNeverin("zrnovnica", neverinski("2025-02-02 01:25:00"), SADA);
  assert.equal(v, null);
});

test("Neverin: bez brzine nema očitanja, bez smjera je promjenjiv", () => {
  assert.equal(procitajNeverin("solin", neverinski(undefined, null), SADA), null);
  const bezSmjera = procitajNeverin("solin", neverinski(undefined, 1.2, null), SADA);
  assert.equal(bezSmjera?.promjenjiv, true);
  assert.equal(bezSmjera?.smjerOd, PRETPOSTAVLJENO.smjerOd);
  assert.equal(procitajNeverin("solin", { status: "error" }, SADA), null);
});

test("Neverin: tišina se prepoznaje kao i drugdje", () => {
  const v = procitajNeverin("pujanke", neverinski(undefined, 0.2), SADA);
  assert.equal(v?.tisina, true);
});

test("Vrboran preuzima vodstvo kad javi, a ostala očitanja se čuvaju", async (t) => {
  posluzi(t, {
    dhmz: xml([["Split-Marjan", "SW", "2"]]),
    split3: { brzina: azo([[20, 1.7]]), smjer: azo([[20, 235.2]]) },
    neverin: { "split-vrboran": neverinski() },
  });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "vrboran");
  assert.equal(zrak.stanje.brzina, 0.6);
  assert.equal(zrak.stanje.smjerOd, 111);
  assert.deepEqual(
    zrak.ocitanja.map((o) => o.postaja),
    ["vrboran", "split3", "marjan", "ldsp"],
    "ostala očitanja se čuvaju za usporedbu",
  );
});

test("kad Neverin šuti, karta ostaje na provjerenim postajama", async (t) => {
  posluzi(t, {
    dhmz: xml([["Split-Marjan", "SW", "2"]]),
    split3: { brzina: azo([[20, 1.7]]), smjer: azo([[20, 235.2]]) },
  });

  const zrak = await dohvatiZrak(SADA);
  assert.equal(zrak.vjetar?.postaja, "split3");
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
