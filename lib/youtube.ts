// lib/youtube.ts
export type ReferenceVideoMeta = {
  title: string;
  channel: string;
  thumbnailUrl: string;
};

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch {
    return false;
  }
}

// Best-effort: works for youtube.com/watch, youtu.be/xxx, youtube.com/shorts/xxx
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim();
      return id || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;

      // /shorts/ID
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) return parts[1];

      // /embed/ID
      if (parts[0] === 'embed' && parts[1]) return parts[1];
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch YouTube oEmbed meta (title, author_name, thumbnail_url)
export async function fetchYouTubeMeta(url: string): Promise<ReferenceVideoMeta | null> {
  if (!isYouTubeUrl(url)) return null;

  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

  try {
    const res = await fetch(oembed);
    if (!res.ok) return null;
    const data: any = await res.json();

    return {
      title: String(data?.title ?? 'Reference Video'),
      channel: String(data?.author_name ?? 'YouTube'),
      thumbnailUrl: String(data?.thumbnail_url ?? ''),
    };
  } catch {
    return null;
  }
}