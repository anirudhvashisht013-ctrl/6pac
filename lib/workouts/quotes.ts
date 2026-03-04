export type WorkoutQuote = {
  quote: string;
  author: string;
};

// Online JSON source used when available.
const ZEN_QUOTES_URL = 'https://zenquotes.io/api/quotes';

const FALLBACK_QUOTES: WorkoutQuote[] = [
  { quote: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { quote: 'The only way out is through.', author: 'Robert Frost' },
  { quote: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { quote: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { quote: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { quote: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { quote: 'Strength does not come from physical capacity. It comes from an indomitable will.', author: 'Mahatma Gandhi' },
  { quote: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { quote: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { quote: 'Do not wait to strike till the iron is hot; but make it hot by striking.', author: 'William Butler Yeats' },
  { quote: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
];

function normalizeRemoteQuote(value: unknown): WorkoutQuote | null {
  if (!value || typeof value !== 'object') return null;
  const q = String((value as { q?: unknown }).q || '').trim();
  const a = String((value as { a?: unknown }).a || '').trim();
  if (!q) return null;
  return { quote: q, author: a || 'Unknown' };
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickRandomWorkoutQuote(quotes: WorkoutQuote[], seed?: string): WorkoutQuote {
  if (!quotes.length) return FALLBACK_QUOTES[0];
  if (seed) {
    const index = hashSeed(seed) % quotes.length;
    return quotes[index];
  }
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
}

export async function fetchWorkoutQuotesFromInternet(): Promise<WorkoutQuote[]> {
  try {
    const response = await fetch(ZEN_QUOTES_URL);
    if (!response.ok) return FALLBACK_QUOTES;

    const data = await response.json();
    if (!Array.isArray(data)) return FALLBACK_QUOTES;

    const normalized = data
      .map((item) => normalizeRemoteQuote(item))
      .filter((quote): quote is WorkoutQuote => !!quote);

    return normalized.length > 0 ? normalized : FALLBACK_QUOTES;
  } catch {
    return FALLBACK_QUOTES;
  }
}

export function getFallbackWorkoutQuotes(): WorkoutQuote[] {
  return FALLBACK_QUOTES;
}
