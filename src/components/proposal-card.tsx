import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { NEIGHBORHOODS, CATEGORIES } from "@/lib/constants";
import type { Proposal } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <Link
      href={`/prijedlozi/${proposal.slug}`}
      className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-900">{proposal.title}</h3>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
        {proposal.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span className="font-medium text-emerald-700">
          {NEIGHBORHOODS[proposal.neighborhood]}
        </span>
        <span>{CATEGORIES[proposal.category]}</span>
        <span>ažurirano {formatDate(proposal.updatedAt)}</span>
      </div>
    </Link>
  );
}
