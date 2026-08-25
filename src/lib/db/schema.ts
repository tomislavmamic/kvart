import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const neighborhoodEnum = pgEnum("neighborhood", ["dracevac", "bilice"]);

export const categoryEnum = pgEnum("category", [
  "promet",
  "ceste",
  "voda",
  "rasvjeta",
  "zelenilo",
  "otpad",
  "urbanizam",
  "ostalo",
]);

export const statusEnum = pgEnum("status", [
  "objavljeno",
  "poslano_gradu",
  "u_tijeku",
  "rijeseno",
  "odbijeno",
  "na_cekanju",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "merged",
]);

export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  neighborhood: neighborhoodEnum("neighborhood").notNull(),
  category: categoryEnum("category").notNull(),
  status: statusEnum("status").notNull().default("objavljeno"),
  redditUrl: text("reddit_url"),
  photoUrls: text("photo_urls").array().notNull().default([]),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const statusUpdates = pgTable("status_updates", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  status: statusEnum("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  neighborhood: neighborhoodEnum("neighborhood").notNull(),
  category: categoryEnum("category").notNull(),
  submitterName: text("submitter_name"),
  submitterContact: text("submitter_contact"),
  photoUrls: text("photo_urls").array().notNull().default([]),
  reviewStatus: submissionStatusEnum("review_status").notNull().default("pending"),
  proposalId: integer("proposal_id").references(() => proposals.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Jačina mirisa. Skraćena inačica ljestvice iz VDI 3882, koja ima sedam
 * stupnjeva — ovdje četiri, jer se dojava ispunjava s prozora, a ne za stolom.
 * Broj je zapisan uz naziv da se poredak ne izgubi u prijevodu.
 */
export const odourStrengthEnum = pgEnum("odour_strength", [
  "slabo",
  "osjetno",
  "jako",
  "nepodnosivo",
]);

/**
 * Dojava mirisa. Pučka inačica mrežne metode iz EN 16841-1: umjesto obučenih
 * ocjenjivača na zadanim točkama, ljudi javljaju odakle su i kada osjetili.
 *
 * Sat se pamti odvojeno od vremena unosa jer se javlja i naknadno — a bez
 * točnog sata dojava se ne može spojiti s vjetrom, i tada ne vrijedi ništa.
 *
 * Ne traži se ni ime ni kontakt. Za ružu dojava ne trebaju, a svaki podatak
 * koji se ne prikupi ne može ni procuriti.
 */
export const odourReports = pgTable(
  "odour_reports",
  {
    id: serial("id").primaryKey(),
    /** Sat u kojem se miris osjetio, zaokružen na puni sat, u UTC-u. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /**
     * Je li se miris osjetio ili ne.
     *
     * Dojava „ne smrdi" vrijedi koliko i „smrdi": bez nje se iz zbroja ne
     * može izvesti *koliko često* smrdi, nego samo koliko je ljudi javilo —
     * a to miješa miris s voljom za javljanjem. Mrežna metoda iz EN 16841-1
     * na istom počiva: promatrač bilježi i kad nema mirisa.
     *
     * Stari zapisi nemaju stupac, pa im zadana vrijednost mora biti istina.
     */
    smelled: boolean("smelled").notNull().default(true),
    /** Jačina; nema je kad se miris nije osjetio. */
    strength: odourStrengthEnum("strength"),
    /**
     * Kvart; ostaje zbog starih zapisa, ali obrazac ga više ne pita.
     *
     * Dvije kućice s istim odgovorom za sve dojave iz jednog kvarta nisu
     * govorile ništa što adresa ili koordinata ne kažu bolje, a bile su dva
     * dodira više na mobitelu.
     */
    neighborhood: neighborhoodEnum("neighborhood"),
    /** Najbliža adresa ili orijentir, kako ju je dojavitelj napisao. */
    place: text("place"),
    /**
     * Slobodna napomena; obrazac je više ne pita.
     *
     * Stupac ostaje zbog starih zapisa. Napomenu nitko nije čitao ni mogao
     * pretvoriti u brojku — a polje koje ništa ne mijenja u zaključku samo
     * produljuje obrazac. Ako ikad zatreba, bolja je zamjena jedno pitanje
     * sa zadanim odgovorima (trulo jaje / dim / drugo), jer se ono da zbrojiti.
     */
    note: text("note"),
    /**
     * Kraj razdoblja u kojem se miris osjećao, zaokružen na puni sat.
     *
     * Dojava time postaje raspon, a ne trenutak: model i EN 16841 govore u
     * *satima mirisa*, pa raspon od 21 do 23 h nosi tri sata, svaki sa
     * svojim izmjerenim vjetrom. Prazno znači da je dojava jedan sat.
     */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** Miris je u trenutku javljanja još trajao; kraj se tada ne zna. */
    ongoing: boolean("ongoing").notNull().default(false),
    /**
     * Nasumična oznaka preglednika, bez ikakve veze s identitetom.
     *
     * Služi dvomu: da se ista dojava ne broji dvaput i da jedan uporan nos
     * ne prevlada zbroj — dojave se pri računu sažimaju po dojavitelju i
     * satu. Oznaka se stvara u pregledniku, ne prima ime ni kontakt, i
     * dojavitelj je smije obrisati.
     */
    reporterId: text("reporter_id"),
    /**
     * Mjesto s kojeg je dojava, zaokruženo na ~100 m prije spremanja.
     *
     * Model ima razlučivost od nekoliko stotina metara, pa točnija koordinata
     * ne bi rekla ništa više o zraku, a rekla bi previše o dojavitelju.
     */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** Sakriva pojedinu dojavu iz zbroja, bez brisanja traga. */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("odour_reports_occurred_at_idx").on(table.occurredAt),
    index("odour_reports_reporter_idx").on(table.reporterId),
  ],
);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  proposalId: integer("proposal_id").references(() => proposals.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const proposalsRelations = relations(proposals, ({ many }) => ({
  statusUpdates: many(statusUpdates),
  documents: many(documents),
}));

export const statusUpdatesRelations = relations(statusUpdates, ({ one }) => ({
  proposal: one(proposals, {
    fields: [statusUpdates.proposalId],
    references: [proposals.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  proposal: one(proposals, {
    fields: [documents.proposalId],
    references: [proposals.id],
  }),
}));

export type Proposal = typeof proposals.$inferSelect;
export type StatusUpdate = typeof statusUpdates.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type OdourReport = typeof odourReports.$inferSelect;
