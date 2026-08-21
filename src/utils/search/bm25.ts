/**
 * @file bm25.ts
 * @description Advanced multi-field BM25 lexical ranking engine with fuzzy typo tolerance,
 * stopword filtering, and field weighting (Title 3x, Tags 2x, Content 1x).
 */

/** Common English stopwords to filter out during tokenization */
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text into lowercase alphanumeric tokens.
 *
 * @param text - Raw source string
 * @param filterStopwords - Whether to exclude common stopwords (default: false)
 * @returns Array of clean tokens
 */
export const tokenizeText = (text: string, filterStopwords: boolean = false): string[] => {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  if (filterStopwords) {
    const filtered = tokens.filter(t => !STOPWORDS.has(t));
    return filtered.length > 0 ? filtered : tokens;
  }
  return tokens;
};

/**
 * Computes Levenshtein edit distance between two strings.
 * Used for fuzzy search typo-correction.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Checks if candidate token matches target query token either exactly, as prefix, or fuzzy.
 */
export const isTokenMatch = (
  candidate: string,
  queryToken: string
): { matched: boolean; isFuzzy: boolean; scoreModifier: number } => {
  const cand = candidate.toLowerCase();
  const q = queryToken.toLowerCase();

  // 1. Exact match
  if (cand === q) {
    return { matched: true, isFuzzy: false, scoreModifier: 1.0 };
  }

  // 2. Prefix match (e.g. "art" in "artificial")
  if (cand.startsWith(q) && q.length >= 3) {
    return { matched: true, isFuzzy: false, scoreModifier: 0.85 };
  }

  // 3. Substring match
  if (cand.includes(q) && q.length >= 3) {
    return { matched: true, isFuzzy: false, scoreModifier: 0.75 };
  }

  // 4. Fuzzy Levenshtein match for longer words
  if (q.length >= 4) {
    const maxDistance = q.length <= 6 ? 1 : 2;
    const dist = levenshteinDistance(cand, q);
    if (dist <= maxDistance) {
      const penalty = 1.0 - (dist * 0.25);
      return { matched: true, isFuzzy: true, scoreModifier: Math.max(0.4, penalty) };
    }
  }

  return { matched: false, isFuzzy: false, scoreModifier: 0 };
};

/** Field weighting parameters for BM25 multi-field retrieval */
export interface BM25FieldWeights {
  titleWeight?: number;
  tagWeight?: number;
  contentWeight?: number;
}

const DEFAULT_WEIGHTS: Required<BM25FieldWeights> = {
  titleWeight: 3.0,
  tagWeight: 2.0,
  contentWeight: 1.0
};

/**
 * Computes BM25 multi-field lexical score for a note against search query tokens.
 *
 * @param queryTokens - Tokenized search query
 * @param fields - Note text fields (title, tags, content)
 * @param avgDocLength - Average document token length across corpus
 * @param weights - Optional custom field weights
 * @returns Object with normalized BM25 score, matched fields, and fuzzy match flag.
 */
export const scoreBM25Note = (
  queryTokens: string[],
  fields: { title: string; tags?: string[]; content: string },
  avgDocLength: number = 150,
  weights: BM25FieldWeights = DEFAULT_WEIGHTS
): {
  score: number;
  matchedFields: ('title' | 'tag' | 'content')[];
  isFuzzy: boolean;
} => {
  if (!queryTokens.length) {
    return { score: 0, matchedFields: [], isFuzzy: false };
  }

  const { titleWeight, tagWeight, contentWeight } = { ...DEFAULT_WEIGHTS, ...weights };

  const titleTokens = tokenizeText(fields.title || '');
  const tagTokens = tokenizeText((fields.tags || []).join(' '));
  const contentTokens = tokenizeText(fields.content || '');

  const totalTokens = titleTokens.length + tagTokens.length + contentTokens.length;
  const docLen = Math.max(1, totalTokens);

  const k1 = 1.2;
  const b = 0.75;
  const lenNorm = 1 - b + b * (docLen / (avgDocLength || 1));

  let rawScore = 0;
  const matchedFieldsSet = new Set<'title' | 'tag' | 'content'>();
  let hasFuzzy = false;

  for (const q of queryTokens) {
    // 1. Title field scoring
    let titleTf = 0;
    for (const t of titleTokens) {
      const match = isTokenMatch(t, q);
      if (match.matched) {
        titleTf += match.scoreModifier;
        matchedFieldsSet.add('title');
        if (match.isFuzzy) hasFuzzy = true;
      }
    }

    // 2. Tag field scoring
    let tagTf = 0;
    for (const t of tagTokens) {
      const match = isTokenMatch(t, q);
      if (match.matched) {
        tagTf += match.scoreModifier;
        matchedFieldsSet.add('tag');
        if (match.isFuzzy) hasFuzzy = true;
      }
    }

    // 3. Content field scoring
    let contentTf = 0;
    for (const t of contentTokens) {
      const match = isTokenMatch(t, q);
      if (match.matched) {
        contentTf += match.scoreModifier;
        matchedFieldsSet.add('content');
        if (match.isFuzzy) hasFuzzy = true;
      }
    }

    // Weighted composite term frequency
    const weightedTf = titleTf * titleWeight + tagTf * tagWeight + contentTf * contentWeight;

    if (weightedTf > 0) {
      const termScore = (weightedTf * (k1 + 1)) / (weightedTf + k1 * lenNorm);
      rawScore += termScore;
    }
  }

  // Exact phrase match boost on title
  const fullQuery = queryTokens.join(' ').toLowerCase();
  if (fields.title.toLowerCase().trim() === fullQuery) {
    rawScore += 5.0;
    matchedFieldsSet.add('title');
  } else if (fields.title.toLowerCase().includes(fullQuery)) {
    rawScore += 2.5;
    matchedFieldsSet.add('title');
  }

  // Normalize score between 0.0 and 1.0
  const maxPossible = Math.max(1, queryTokens.length * titleWeight * 2);
  const normalizedScore = Math.min(1.0, rawScore / maxPossible);

  return {
    score: normalizedScore,
    matchedFields: Array.from(matchedFieldsSet),
    isFuzzy: hasFuzzy
  };
};

/**
 * Extracts a concise excerpt around the best matched search tokens in content.
 *
 * @param content - Full note markdown content
 * @param queryTokens - Search query tokens
 * @param maxChars - Maximum excerpt character length (default: 160)
 * @returns Snippet string with surrounding ellipsis
 */
export const extractSearchSnippet = (
  content: string,
  queryTokens: string[],
  maxChars: number = 160
): string => {
  if (!content) return '';
  const cleanContent = content.replace(/[#*`_~[\]()-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanContent.length <= maxChars) return cleanContent;

  const lowerContent = cleanContent.toLowerCase();
  let bestIndex = -1;

  for (const q of queryTokens) {
    const idx = lowerContent.indexOf(q.toLowerCase());
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    return cleanContent.slice(0, maxChars) + '...';
  }

  const start = Math.max(0, bestIndex - Math.floor(maxChars / 3));
  const end = Math.min(cleanContent.length, start + maxChars);

  let snippet = cleanContent.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < cleanContent.length) snippet = snippet + '...';

  return snippet;
};
