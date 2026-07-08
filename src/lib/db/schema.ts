import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
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
