import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposalBySlug } from "@/lib/queries";
import { getRedditCommentCount } from "@/lib/reddit";
import { StatusBadge } from "@/components/status-badge";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Params {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const proposal = await getProposalBySlug(slug);
  return { title: proposal?.title ?? "Prijedlog" };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const proposal = await getProposalBySlug(slug);
  if (!proposal) notFound();

  const commentCount = proposal.redditUrl
    ? await getRedditCommentCount(proposal.redditUrl)
    : null;

  const shareText = encodeURIComponent(
    `${proposal.title} — pogledaj na Naš kvart:`
  );

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={proposal.status} />
        <span className="text-sm font-medium text-emerald-700">
          {NEIGHBORHOODS[proposal.neighborhood]}
        </span>
        <span className="text-sm text-zinc-500">
          {CATEGORIES[proposal.category]}
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">{proposal.title}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        objavljeno {formatDate(proposal.createdAt)}
      </p>

      <div className="mt-6 whitespace-pre-line leading-relaxed text-zinc-800">
        {proposal.description}
      </div>

      {proposal.photoUrls.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {proposal.photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={proposal.title}
              className="w-full rounded-xl border border-zinc-200 object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {proposal.redditUrl && (
          <a
            href={proposal.redditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Rasprava na Redditu
            {commentCount !== null && <span>({commentCount} komentara)</span>}
            <span aria-hidden>→</span>
          </a>
        )}
        <a
          href={`https://wa.me/?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Podijeli na WhatsApp
        </a>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Tijek rješavanja</h2>
        <ol className="mt-4 space-y-0 border-l-2 border-zinc-200">
          {proposal.statusUpdates.map((update) => (
            <li key={update.id} className="relative pb-6 pl-6 last:pb-0">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-emerald-600" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{STATUSES[update.status]}</span>
                <span className="text-xs text-zinc-400">
                  {formatDate(update.createdAt)}
                </span>
              </div>
              {update.note && (
                <p className="mt-1 text-sm text-zinc-600">{update.note}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {proposal.documents.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Dokumenti</h2>
          <ul className="mt-3 space-y-2">
            {proposal.documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 underline hover:text-emerald-900"
                >
                  📄 {doc.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
