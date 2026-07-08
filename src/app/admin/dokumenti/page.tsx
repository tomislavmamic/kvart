import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isModerator } from "@/lib/auth";
import { getDocuments } from "@/lib/queries";
import { deleteDocument } from "@/lib/actions/admin";
import { UploadForm } from "./upload-form";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dokumenti — moderacija" };

export default async function AdminDocumentsPage() {
  if (!(await isModerator())) redirect("/admin/login");

  const docs = await getDocuments();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← Natrag na moderaciju
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Dokumenti</h1>
      </div>

      <UploadForm />

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {docs.length === 0 && (
          <li className="p-4 text-sm text-zinc-500">Nema dokumenata.</li>
        )}
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 p-4"
          >
            <div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 underline"
              >
                {doc.title}
              </a>
              <p className="text-xs text-zinc-400">
                {formatDate(doc.createdAt)}
                {doc.proposalTitle && ` · uz: ${doc.proposalTitle}`}
              </p>
            </div>
            <form action={deleteDocument}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="text-sm text-rose-700 hover:underline">
                Obriši
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
