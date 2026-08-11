import Link from "next/link";
import { getDocuments } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Dokumenti",
  description:
    "Prostorni planovi, dopisi Gradu Splitu, odgovori i zapisnici važni za Dračevac i Bilice.",
});

export default async function DocumentsPage() {
  const docs = await getDocuments();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Dokumenti</h1>
      <p className="mt-2 text-zinc-600">
        Prostorni planovi, dopisi Gradu Splitu i odgovori, zapisnici i ostali
        materijali važni za Dračevac i Bilice.
      </p>

      <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {docs.length === 0 && (
          <li className="p-5 text-sm text-zinc-500">
            Još nema objavljenih dokumenata.
          </li>
        )}
        {docs.map((doc) => (
          <li key={doc.id} className="p-4">
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline hover:text-emerald-900"
            >
              📄 {doc.title}
            </a>
            <div className="mt-1 text-xs text-zinc-400">
              {formatDate(doc.createdAt)}
              {doc.proposalSlug && (
                <>
                  {" · uz prijedlog: "}
                  <Link
                    href={`/prijedlozi/${doc.proposalSlug}`}
                    className="underline"
                  >
                    {doc.proposalTitle}
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
