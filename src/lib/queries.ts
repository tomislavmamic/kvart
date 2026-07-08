import { desc, eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  statusUpdates,
  submissions,
  documents,
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

export async function getStats() {
  const rows = await db
    .select({ status: proposals.status, n: count() })
    .from(proposals)
    .groupBy(proposals.status);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return {
    rijeseno: byStatus["rijeseno"] ?? 0,
    uTijeku: (byStatus["u_tijeku"] ?? 0) + (byStatus["poslano_gradu"] ?? 0),
    ukupno: rows.reduce((acc, r) => acc + Number(r.n), 0),
  };
}

export async function getRecentUpdates(limit = 5) {
  return db
    .select({
      id: statusUpdates.id,
      status: statusUpdates.status,
      note: statusUpdates.note,
      createdAt: statusUpdates.createdAt,
      proposalTitle: proposals.title,
      proposalSlug: proposals.slug,
    })
    .from(statusUpdates)
    .innerJoin(proposals, eq(statusUpdates.proposalId, proposals.id))
    .orderBy(desc(statusUpdates.createdAt))
    .limit(limit);
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
