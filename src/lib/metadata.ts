import type { Metadata } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "./constants";

export const SITE_URL = new URL("https://kvart-sage.vercel.app");
export const SOCIAL_IMAGE_ALT =
  "Zračna snimka Dračevca i Bilica s nazivom Naš kvart";

const OPEN_GRAPH_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SOCIAL_IMAGE_ALT,
  type: "image/png",
};

const TWITTER_IMAGE = {
  url: "/twitter-image",
  width: 1200,
  height: 630,
  alt: SOCIAL_IMAGE_ALT,
};

export const DEFAULT_SHARE_DESCRIPTION = SITE_DESCRIPTION;

export const PROBLEMS_SHARE_DESCRIPTION =
  "Pregledaj što su susjedi prijavili, što je poslano Gradu i dokle je stiglo rješavanje.";

type PageMetadataInput = {
  title: string;
  description: string;
};

export function createPageMetadata({
  title,
  description,
}: PageMetadataInput): Metadata {
  const socialTitle = title === SITE_NAME ? SITE_NAME : `${title} — Naš kvart`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "hr_HR",
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      images: [OPEN_GRAPH_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}

export function publicDescriptionExcerpt(
  value: string | null | undefined,
  fallback = PROBLEMS_SHARE_DESCRIPTION,
  limit = 160,
): string {
  const normalized = value?.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    return fallback;
  }

  const characters = Array.from(normalized);
  if (characters.length <= limit) {
    return normalized;
  }

  const available = Math.max(1, limit - 1);
  const candidate = characters.slice(0, available).join("").trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  const wordBoundary = lastSpace >= Math.floor(available * 0.6);
  const shortened = (wordBoundary ? candidate.slice(0, lastSpace) : candidate).trimEnd();

  return `${shortened}…`;
}

export function createProposalMetadata(
  proposal: { title: string; description: string | null } | null | undefined,
): Metadata {
  return createPageMetadata({
    title: proposal?.title ?? "Prijedlog",
    description: publicDescriptionExcerpt(proposal?.description),
  });
}
