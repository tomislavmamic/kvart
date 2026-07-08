"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  statusUpdates,
  submissions,
  documents,
} from "@/lib/db/schema";
import {
  createSession,
  destroySession,
  isModerator,
  verifyPassword,
} from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { storeFile } from "@/lib/upload";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import type { Neighborhood, Category, Status } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireModerator(): Promise<void> {
  if (!(await isModerator())) redirect("/admin/login");
}

export async function login(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    return { ok: false, error: "Pogrešna lozinka." };
  }
  await createSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "prijedlog";
  const existing = await db
    .select({ slug: proposals.slug })
    .from(proposals)
    .where(sql`${proposals.slug} LIKE ${base + "%"}`);
  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
}

/** Approves a submission by publishing it as a proposal. */
export async function approveSubmission(formData: FormData): Promise<void> {
  await requireModerator();
  const id = Number(formData.get("id"));
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, id));
  if (!sub || sub.reviewStatus !== "pending") return;

  const slug = await uniqueSlug(sub.title);
  const [proposal] = await db
    .insert(proposals)
    .values({
      slug,
      title: sub.title,
      description: sub.description,
      neighborhood: sub.neighborhood,
      category: sub.category,
      photoUrls: sub.photoUrls,
    })
    .returning();

  await db.insert(statusUpdates).values({
    proposalId: proposal.id,
    status: "objavljeno",
    note: "Prijedlog objavljen na stranici.",
  });

  await db
    .update(submissions)
    .set({ reviewStatus: "approved", proposalId: proposal.id })
    .where(eq(submissions.id, id));

  revalidatePath("/admin");
  revalidatePath("/prijedlozi");
  revalidatePath("/");
}

export async function rejectSubmission(formData: FormData): Promise<void> {
  await requireModerator();
  const id = Number(formData.get("id"));
  await db
    .update(submissions)
    .set({ reviewStatus: "rejected" })
    .where(eq(submissions.id, id));
  revalidatePath("/admin");
}

/** Marks a submission as a duplicate of an existing proposal. */
export async function mergeSubmission(formData: FormData): Promise<ActionResult> {
  await requireModerator();
  const id = Number(formData.get("id"));
  const proposalId = Number(formData.get("proposalId"));
  const [proposal] = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.id, proposalId));
  if (!proposal) return { ok: false, error: `Prijedlog #${proposalId} ne postoji.` };

  await db
    .update(submissions)
    .set({ reviewStatus: "merged", proposalId })
    .where(eq(submissions.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateProposal(formData: FormData): Promise<ActionResult> {
  await requireModerator();
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "");
  const category = String(formData.get("category") ?? "");
  const redditUrl = String(formData.get("redditUrl") ?? "").trim() || null;

  if (title.length < 5) return { ok: false, error: "Naslov je prekratak." };
  if (description.length < 20) return { ok: false, error: "Opis je prekratak." };
  if (!(neighborhood in NEIGHBORHOODS) || !(category in CATEGORIES)) {
    return { ok: false, error: "Neispravan kvart ili kategorija." };
  }
  if (redditUrl && !redditUrl.startsWith("https://www.reddit.com/")) {
    return { ok: false, error: "Reddit poveznica mora počinjati s https://www.reddit.com/" };
  }

  await db
    .update(proposals)
    .set({
      title,
      description,
      neighborhood: neighborhood as Neighborhood,
      category: category as Category,
      redditUrl,
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, id));

  revalidatePath("/prijedlozi");
  revalidatePath("/");
  return { ok: true };
}

export async function addStatusUpdate(formData: FormData): Promise<ActionResult> {
  await requireModerator();
  const proposalId = Number(formData.get("proposalId"));
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!(status in STATUSES)) return { ok: false, error: "Neispravan status." };

  await db.insert(statusUpdates).values({
    proposalId,
    status: status as Status,
    note,
  });
  await db
    .update(proposals)
    .set({ status: status as Status, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));

  revalidatePath("/prijedlozi");
  revalidatePath("/");
  return { ok: true };
}

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  await requireModerator();
  const title = String(formData.get("title") ?? "").trim();
  const proposalIdRaw = String(formData.get("proposalId") ?? "").trim();
  const file = formData.get("file");

  if (title.length < 3) return { ok: false, error: "Naslov je prekratak." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Odaberite datoteku." };
  }

  let fileUrl: string;
  try {
    fileUrl = await storeFile(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška pri spremanju." };
  }

  await db.insert(documents).values({
    title,
    fileUrl,
    proposalId: proposalIdRaw ? Number(proposalIdRaw) : null,
  });

  revalidatePath("/dokumenti");
  return { ok: true };
}

export async function deleteDocument(formData: FormData): Promise<void> {
  await requireModerator();
  const id = Number(formData.get("id"));
  await db.delete(documents).where(eq(documents.id, id));
  revalidatePath("/dokumenti");
  revalidatePath("/admin/dokumenti");
}
