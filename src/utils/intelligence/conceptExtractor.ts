/**
 * @file conceptExtractor.ts
 * @description Knowledge Intelligence: Automated concept, entity, and alias extraction from note text.
 * Identifies technologies, concepts, organizations, people, and candidate graph links.
 */

export type EntityType = 'concept' | 'technology' | 'organization' | 'person' | 'topic';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  confidence: number;
  occurrences: number;
  aliases?: string[];
  contextSnippet?: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  suggestedWikiLinks: string[];
  keyTopics: string[];
}

const COMMON_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'were', 'which',
  'about', 'into', 'some', 'more', 'when', 'them', 'they', 'what', 'then', 'will',
  'there', 'their', 'also', 'note', 'page', 'notes', 'link', 'links'
]);

const TECH_PATTERNS = [
  /\b(React|TypeScript|JavaScript|Node\.js|Python|Rust|Go|GraphQL|IndexedDB|Dexie|Vite|TailwindCSS|D3|PostgreSQL|SQLite|Docker|Kubernetes|WASM|WebAssembly|ONNX|Transformers|OpenAI|Anthropic|Gemini)\b/gi
];

/**
 * Extracts entities, concepts, and prospective wiki-links from Markdown content.
 *
 * @param content - Markdown note text.
 * @param existingTitles - Known note titles in the workspace for wiki-link detection.
 * @returns {@link ExtractionResult}
 */
export function extractConceptsFromText(
  content: string,
  existingTitles: string[] = []
): ExtractionResult {
  if (!content || !content.trim()) {
    return { entities: [], suggestedWikiLinks: [], keyTopics: [] };
  }

  const entitiesMap = new Map<string, ExtractedEntity>();
  const suggestedLinksSet = new Set<string>();

  // 1. Detect existing note title mentions (candidate wiki-links)
  const lowerContent = content.toLowerCase();
  for (const title of existingTitles) {
    if (title.length < 3) continue;
    const lowerTitle = title.toLowerCase();
    if (lowerContent.includes(lowerTitle)) {
      suggestedLinksSet.add(title);
    }
  }

  // 2. Extract explicitly bracketed [[Wiki Links]]
  const bracketMatches = content.matchAll(/\[\[(.*?)\]\]/g);
  for (const match of bracketMatches) {
    const raw = match[1].trim();
    if (raw) {
      suggestedLinksSet.add(raw);
      entitiesMap.set(raw.toLowerCase(), {
        name: raw,
        type: 'concept',
        confidence: 0.95,
        occurrences: 1
      });
    }
  }

  // 3. Extract Technologies via predefined taxonomy patterns
  for (const pattern of TECH_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[0];
      const key = name.toLowerCase();
      const existing = entitiesMap.get(key);
      if (existing) {
        existing.occurrences++;
      } else {
        entitiesMap.set(key, {
          name,
          type: 'technology',
          confidence: 0.9,
          occurrences: 1
        });
      }
    }
  }

  // 4. Extract Capitalized Multi-word Concepts (e.g. "Knowledge Graph", "Vector Search", "Spaced Repetition")
  const capitalizedPhrases = content.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  for (const match of capitalizedPhrases) {
    const phrase = match[0].trim();
    const lowerPhrase = phrase.toLowerCase();
    if (COMMON_STOPWORDS.has(lowerPhrase)) continue;

    const existing = entitiesMap.get(lowerPhrase);
    if (existing) {
      existing.occurrences++;
    } else {
      entitiesMap.set(lowerPhrase, {
        name: phrase,
        type: 'concept',
        confidence: 0.75,
        occurrences: 1
      });
    }
  }

  // 5. Extract Markdown Tags (#tag)
  const tagMatches = content.matchAll(/(?:^|\s)#([a-zA-Z0-9_\-/]+)/g);
  const keyTopics: string[] = [];
  for (const match of tagMatches) {
    const tag = match[1].toLowerCase();
    if (!COMMON_STOPWORDS.has(tag)) {
      keyTopics.push(tag);
      if (!entitiesMap.has(tag)) {
        entitiesMap.set(tag, {
          name: '#' + tag,
          type: 'topic',
          confidence: 0.85,
          occurrences: 1
        });
      }
    }
  }

  const entities = Array.from(entitiesMap.values()).sort((a, b) => b.occurrences - a.occurrences);

  return {
    entities,
    suggestedWikiLinks: Array.from(suggestedLinksSet),
    keyTopics: Array.from(new Set(keyTopics))
  };
}
