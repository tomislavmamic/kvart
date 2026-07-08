import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * Stores an uploaded file and returns its public URL.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured (production),
 * otherwise falls back to public/uploads for local development.
 */
export async function storeFile(file: File): Promise<string> {
  if (file.size === 0) throw new Error("Prazna datoteka.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Datoteka je veća od 10 MB.");
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Dozvoljene su samo slike (JPG, PNG, WebP, HEIC) i PDF.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`kvart/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return blob.url;
  }

  // Local development fallback — not used on Vercel (read-only filesystem).
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
