import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isModerator } from "@/lib/auth";
import { getProposalById } from "@/lib/queries";
import { EditForms } from "./edit-forms";
import { STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Uredi prijedlog" };

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isModerator())) redirect("/admin/login");

  const { id } = await params;
  const proposal = await getProposalById(Number(id));
  if (!proposal) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← Natrag na moderaciju
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          Uredi prijedlog #{proposal.id}
        </h1>
        <Link
          href={`/prijedlozi/${proposal.slug}`}
          className="text-sm text-zinc-500 underline"
        >
          Pogledaj javnu stranicu →
        </Link>
      </div>

      <EditForms proposal={proposal} />

      <section>
        <h2 className="text-lg font-bold">Povijest statusa</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {proposal.statusUpdates.map((u) => (
            <li key={u.id} className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
              <span className="font-semibold">{STATUSES[u.status]}</span>{" "}
              <span className="text-xs text-zinc-400">
                {formatDate(u.createdAt)}
              </span>
              {u.note && <p className="mt-1 text-zinc-600">{u.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
