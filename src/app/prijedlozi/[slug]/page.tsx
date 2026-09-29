import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposalBySlug } from "@/lib/queries";
import { getRedditCommentCount } from "@/lib/reddit";
import { StatusBadge } from "@/components/status-badge";
import { NEIGHBORHOODS, CATEGORIES, STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createProposalMetadata } from "@/lib/metadata";
import Link from "next/link";
import { getFeaturedProposal } from "@/lib/featured-proposals";
import { AirProposal } from "@/components/proposals/air-proposal";
import { ProposalVisual, RecreationProposal, SidewalkProposal } from "@/components/proposals/spatial-proposals";
import { BiliceRoadProposal } from "@/components/proposals/bilice-road-proposal";
import { SchoolBusProposal } from "@/components/proposals/school-bus-proposal";

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
  const featured = getFeaturedProposal(slug);
  if (featured) return createProposalMetadata(featured);
  const proposal = await getProposalBySlug(slug);
  return createProposalMetadata(
    proposal
      ? { title: proposal.title, description: proposal.description }
      : null,
  );
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const featured = getFeaturedProposal(slug);
  if (featured) {
    const hero = slug === "uredenje-rekreativne-zone-dracevac"
      ? { width: 1614, height: 975, caption: "Dječja igra, sport i zelenilo na tri terase · idejni prikaz." }
      : slug === "uredenje-nogostupa"
        ? { width: 1688, height: 932, caption: "Gušći drvored i hlad uz nogostupe · idejni prikaz razvijenih krošnji." }
        : null;
    const backLink = <Link href="/prijedlozi" className="fokus inline-flex min-h-11 items-center rounded text-sm font-semibold text-maslina">← Svi prijedlozi</Link>;
    const actions = <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">{hero && backLink}<span className="inline-flex min-h-11 items-center font-medium text-kamen-tekst">Prijedlog za razgovor sa susjedima</span><a href={slug === "pracenje-zagadenja-zraka" ? "#ukljuci-se" : "#prijedlog"} className="fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina underline underline-offset-4">{slug === "pracenje-zagadenja-zraka" ? "Kako se uključiti" : "Pogledaj raspored na karti"}</a></div>;
    return (
      <article>
        {!hero && backLink}
        <header className="mb-7 mt-4 max-w-3xl sm:mb-9">
          <h1 className="text-3xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl">{featured.title}</h1>
          <p className="mt-4 text-lg leading-8 text-kamen-tekst">{featured.description}</p>
          {!hero && actions}
        </header>
        {hero && <div className="mb-10 sm:mb-14">
          <ProposalVisual src={featured.image} alt={featured.imageAlt} width={hero.width} height={hero.height} caption={hero.caption} priority />
          {actions}
        </div>}
        {slug === "pracenje-zagadenja-zraka" ? <AirProposal /> : slug === "uredenje-rekreativne-zone-dracevac" ? <RecreationProposal /> : slug === "pristupna-cesta-bilice" ? <BiliceRoadProposal /> : slug === "skolski-autobus-bilice-dracevac" ? <SchoolBusProposal /> : <SidewalkProposal />}
      </article>
    );
  }
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
              {/* Oznaka na crti vremena je oblik, ne natpis — pa smije nositi
                  maslinu živu, koja je za to i rezervirana. */}
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-maslina-zivo" />
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
