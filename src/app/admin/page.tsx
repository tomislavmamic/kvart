import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isModerator } from "@/lib/auth";
import { getPendingSubmissions, getAllProposals } from "@/lib/queries";
import {
  approveSubmission,
  rejectSubmission,
  logout,
} from "@/lib/actions/admin";
import { MergeForm } from "./merge-form";
import { StatusBadge } from "@/components/status-badge";
import { NEIGHBORHOODS, CATEGORIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Moderacija" };

export default async function AdminPage() {
  if (!(await isModerator())) redirect("/admin/login");

  const [pending, allProposals] = await Promise.all([
    getPendingSubmissions(),
    getAllProposals(),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Moderacija</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin/dokumenti" className="text-emerald-700 underline">
            Dokumenti
          </Link>
          <form action={logout}>
            <button className="text-zinc-500 hover:text-zinc-800">
              Odjava
            </button>
          </form>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold">
          Nove prijave{" "}
          <span className="text-zinc-400">({pending.length})</span>
        </h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 && (
            <p className="text-sm text-zinc-500">Nema prijava na čekanju. 🎉</p>
          )}
          {pending.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-semibold">{sub.title}</h3>
                <span className="text-xs text-zinc-400">
                  #{sub.id} · {formatDate(sub.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {NEIGHBORHOODS[sub.neighborhood]} · {CATEGORIES[sub.category]}
                {sub.submitterName && ` · prijavio: ${sub.submitterName}`}
                {sub.submitterContact && ` (${sub.submitterContact})`}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                {sub.description}
              </p>
              {sub.photoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="mt-3 max-h-48 rounded-lg border border-zinc-200"
                />
              ))}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <form action={approveSubmission}>
                  <input type="hidden" name="id" value={sub.id} />
                  <button className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                    Objavi
                  </button>
                </form>
                <form action={rejectSubmission}>
                  <input type="hidden" name="id" value={sub.id} />
                  <button className="rounded-full border border-rose-300 px-4 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    Odbij
                  </button>
                </form>
                <MergeForm submissionId={sub.id} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">
          Objavljeni prijedlozi{" "}
          <span className="text-zinc-400">({allProposals.length})</span>
        </h2>
        <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {allProposals.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <Link
                  href={`/admin/prijedlozi/${p.id}`}
                  className="font-medium hover:underline"
                >
                  #{p.id} {p.title}
                </Link>
                <p className="text-xs text-zinc-400">
                  {NEIGHBORHOODS[p.neighborhood]} · ažurirano{" "}
                  {formatDate(p.updatedAt)}
                  {!p.redditUrl && " · ⚠️ nema Reddit poveznice"}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
