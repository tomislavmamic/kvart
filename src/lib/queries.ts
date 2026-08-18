import { desc, eq, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  statusUpdates,
  submissions,
  documents,
  odourReports,
} from "@/lib/db/schema";
import type { Neighborhood, Category, Status } from "@/lib/constants";

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
      strength: odourReports.strength,
      neighborhood: odourReports.neighborhood,
      place: odourReports.place,
    })
    .from(odourReports)
    .where(and(eq(odourReports.hidden, false), gte(odourReports.occurredAt, od)))
    .orderBy(desc(odourReports.occurredAt));
}
