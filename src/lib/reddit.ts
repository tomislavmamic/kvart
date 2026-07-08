/**
 * Fetches the comment count for a Reddit thread via the public JSON API.
 * Cached for 10 minutes; returns null on any failure so pages degrade
 * gracefully when Reddit is unreachable or rate-limits us.
 */
export async function getRedditCommentCount(
  redditUrl: string
): Promise<number | null> {
  try {
    const url = new URL(redditUrl);
    if (!url.hostname.endsWith("reddit.com")) return null;
    url.hostname = "www.reddit.com";
    url.search = "";
    const jsonUrl = `${url.origin}${url.pathname.replace(/\/$/, "")}.json?limit=1`;

    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": "nas-kvart-split/1.0" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return null;
    const post = data[0]?.data?.children?.[0]?.data;
    return typeof post?.num_comments === "number" ? post.num_comments : null;
  } catch {
    return null;
  }
}
