import { desc, eq, and, gte, inArray, isNotNull, lt, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  statusUpdates,
  submissions,
  documents,
  odourReports,
  windReadings,
} from "@/lib/db/schema";
import type { Neighborhood, Category, Status } from "@/lib/constants";
import { POSTAJE_ZA_RUZU, type SatArhive } from "@/lib/dojave";

export interface ProposalFilters {
  neighborhood?: Neighborhood;
  category?: Category;
  status?: Status;
}

export async function getProposals(filters: ProposalFilters = {}) {
  const conditions = [];
  if (filters.neighborhood) conditions.push(eq(proposals.neighborhood, filters.neighborhood));
  if (filters.category) conditions.push(eq(proposals.category, filters.category));
  if (filters.status) conditions.push(eq(proposals.status, filters.status));

  return db
    .select()
    .from(proposals)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(proposals.updatedAt));
}

export async function getProposalBySlug(slug: string) {
  return db.query.proposals.findFirst({
    where: eq(proposals.slug, slug),
    with: {
      statusUpdates: { orderBy: desc(statusUpdates.createdAt) },
      documents: true,
    },
  });
}

export async function getDocuments() {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      fileUrl: documents.fileUrl,
      createdAt: documents.createdAt,
      proposalTitle: proposals.title,
      proposalSlug: proposals.slug,
    })
    .from(documents)
    .leftJoin(proposals, eq(documents.proposalId, proposals.id))
    .orderBy(desc(documents.createdAt));
}

export async function getPendingSubmissions() {
  return db
    .select()
    .from(submissions)
    .where(eq(submissions.reviewStatus, "pending"))
    .orderBy(desc(submissions.createdAt));
}

export async function getAllProposals() {
  return db.select().from(proposals).orderBy(desc(proposals.updatedAt));
}

export async function getProposalById(id: number) {
  return db.query.proposals.findFirst({
    where: eq(proposals.id, id),
    with: { statusUpdates: { orderBy: desc(statusUpdates.createdAt) } },
  });
}

/**
 * Vraća dojave mirisa za ružu, najnovije prvo.
 *
 * Skrivene se izostavljaju, ali se ne brišu — trag ostaje, zbroj ne.
 *
 * @param danaUnatrag Koliko dana unatrag ide zbroj.
 */
export async function getOdourReports(danaUnatrag = 365) {
  const od = new Date(Date.now() - danaUnatrag * 86_400_000);
  return db
    .select({
      id: odourReports.id,
      occurredAt: odourReports.occurredAt,
      endedAt: odourReports.endedAt,
      durationMin: odourReports.durationMin,
      smelled: odourReports.smelled,
      strength: odourReports.strength,
      neighborhood: odourReports.neighborhood,
      place: odourReports.place,
      // Oznaka preglednika ide u račun, ali nikamo dalje: ruža po njoj samo
      // sažima dojave istog nosa u istom satu.
      reporterId: odourReports.reporterId,
    })
    .from(odourReports)
    .where(and(eq(odourReports.hidden, false), gte(odourReports.occurredAt, od)))
    .orderBy(desc(odourReports.occurredAt));
}

/**
 * Zadnjih nekoliko dojava jednog preglednika — „vaše dojave”.
 *
 * Oznaka je nasumičan niz koji zna samo taj preglednik (`dojavitelj.ts`), pa
 * je upit po njoj ujedno i jedini način da dojavitelj vidi što je poslao —
 * bez računa i bez kontakta. Skrivene se ne vraćaju: tko je skriven iz
 * zbroja, ne treba to doznati kroz vlastiti popis.
 *
 * @param reporterId Oznaka preglednika, već provjerena da izgleda kako treba.
 * @param najvise Koliko dojava najviše, najnovije prvo.
 */
export async function getOdourReportsByReporter(reporterId: string, najvise = 10) {
  return db
    .select({
      id: odourReports.id,
      occurredAt: odourReports.occurredAt,
      endedAt: odourReports.endedAt,
      durationMin: odourReports.durationMin,
      smelled: odourReports.smelled,
      strength: odourReports.strength,
      place: odourReports.place,
      lat: odourReports.lat,
      lng: odourReports.lng,
    })
    .from(odourReports)
    .where(and(eq(odourReports.hidden, false), eq(odourReports.reporterId, reporterId)))
    .orderBy(desc(odourReports.occurredAt))
    .limit(najvise);
}

/** Sat očitanja kao broj sati od epohe; ne ovisi o vremenskoj zoni sjednice. */
const SAT_OCITANJA = sql<number>`floor(extract(epoch from ${windReadings.observedAt}) / 3600)::int`;

/**
 * Izmjereni vjetar iz arhive za zadane sate, sažet po postaji i satu.
 *
 * Arhiva (`wind_readings`) nosi svako očitanje koje je kroz stranicu prošlo:
 * AZO jednom na sat, Neverin svakih pet minuta. Ovdje se sve sažima na sat,
 * i to vektorski i težinski po brzini — prosjek `brzina·sin` i `brzina·cos`
 * — jer bi aritmetički prosjek 350° i 10° dao jug, a tišina ne smije
 * glasati o smjeru. Koja postaja u kojem satu vodi, i što je tišina,
 * odlučuje `vjetarIzArhive` u `dojave.ts`, po istom prvenstvu kao satni vjetar.
 *
 * Očitanja bez smjera (promjenjiv vjetar) ulaze s nultim vektorom: ne glasaju
 * o smjeru, ali im brzina ulazi u prosjek — inače bi sat s promjenjivim
 * povjetarcem ispao kao tišina, a sat s jednim jedinim usmjerenim očitanjem
 * kao siguran smjer.
 *
 * @param sati Sati kao brojevi (`floor(epoha / 3600)`), obično iz `satiDojava`.
 * @returns Po jedan red za svaku postaju i sat koji je javila.
 */
export async function getArchivedWind(sati: readonly number[]): Promise<SatArhive[]> {
  if (sati.length === 0) return [];
  // Raspon uz popis sati: izraz nad `observed_at` ne može na kazalo, raspon
  // može, pa baza najprije odreže sve izvan njega.
  const od = new Date(Math.min(...sati) * 3_600_000);
  const doKraja = new Date((Math.max(...sati) + 1) * 3_600_000);
  return db
    .select({
      station: windReadings.station,
      sat: SAT_OCITANJA,
      // Težinski po brzini: očitanje od 0,0 m/s ne glasa o smjeru.
      sinBrzina: sql<number>`avg(coalesce(${windReadings.speedMs} * sin(radians(${windReadings.directionDeg})), 0))`,
      cosBrzina: sql<number>`avg(coalesce(${windReadings.speedMs} * cos(radians(${windReadings.directionDeg})), 0))`,
      brzina: sql<number>`avg(${windReadings.speedMs})`,
    })
    .from(windReadings)
    .where(
      and(
        gte(windReadings.observedAt, od),
        lt(windReadings.observedAt, doKraja),
        inArray(SAT_OCITANJA, [...sati]),
        inArray(windReadings.station, [...POSTAJE_ZA_RUZU]),
      ),
    )
    .groupBy(windReadings.station, SAT_OCITANJA);
}

/**
 * Zadnji trenutak za koji arhiva ima očitanje sa smjerom, s postaja koje
 * ruža uzima; `null` kad je arhiva prazna. Stranica po tome kaže dokle vjetar
 * doista imamo, umjesto da obeća „spajamo s vjetrom” za sat koji još nije
 * stigao.
 */
export async function getLatestArchivedWindAt(): Promise<Date | null> {
  const [red] = await db
    .select({ zadnji: max(windReadings.observedAt) })
    .from(windReadings)
    .where(
      and(
        isNotNull(windReadings.directionDeg),
        inArray(windReadings.station, [...POSTAJE_ZA_RUZU]),
      ),
    );
  return red?.zadnji ?? null;
}
