/**
 * @file editor-features.test.ts
 * @description Unit tests for Editor features: wiki-links extraction, autocomplete matching, markdown task toggles, and metrics.
 */

import { describe, it, expect } from 'vitest';
import { extractWikiLinks } from '../db/helpers';
import { notesRepository } from '../db/repositories/notesRepository';

describe('Editor Subsystem & Note Formatting Suite', () => {
  describe('Wiki-Link Parsing & Extraction', () => {
    it('extracts unique wiki-links from markdown content', () => {
      const markdown = `
# Engineering Architecture
See [[Distributed Systems]] and [[Event Sourcing]].
Also references [[Distributed Systems]] twice.
      `;
      const links = extractWikiLinks(markdown);
      expect(links).toEqual(['Distributed Systems', 'Event Sourcing']);
    });

    it('ignores wiki-link syntax inside code blocks and inline code', () => {
      const markdown = `
Here is real link: [[Quantum Computing]]
\`\`\`
// Code block should be ignored
import { [[FakeLink]] } from 'lib';
\`\`\`
And inline \`[[NotALink]]\` should also be skipped.
      `;
      const links = extractWikiLinks(markdown);
      expect(links).toEqual(['Quantum Computing']);
    });
  });

  describe('Markdown Interactive Task List Toggling', () => {
    it('toggles task checkbox states from unchecked to checked and back', () => {
      const initialContent = '- [ ] First task\n- [x] Second task\n- [ ] Third task';

      // Toggle first task (index 0) from unchecked to checked
      let count = 0;
      const targetIndex = 0;
      const step1 = initialContent.replace(/- \[( |x|X)\]/g, (match) => {
        if (count === targetIndex) {
          count++;
          return match.includes('x') || match.includes('X') ? '- [ ]' : '- [x]';
        }
        count++;
        return match;
      });
      expect(step1).toBe('- [x] First task\n- [x] Second task\n- [ ] Third task');

      // Toggle second task (index 1) from checked to unchecked
      count = 0;
      const step2 = step1.replace(/- \[( |x|X)\]/g, (match) => {
        if (count === 1) {
          count++;
          return match.includes('x') || match.includes('X') ? '- [ ]' : '- [x]';
        }
        count++;
        return match;
      });
      expect(step2).toBe('- [x] First task\n- [ ] Second task\n- [ ] Third task');
    });
  });

  describe('Text Metrics Calculation', () => {
    it('accurately computes word count and estimated reading time', () => {
      const empty = notesRepository.computeTextMetrics('');
      expect(empty.wordCount).toBe(0);
      expect(empty.readingTime).toBe(0);

      const singleWord = notesRepository.computeTextMetrics('Hello');
      expect(singleWord.wordCount).toBe(1);
      expect(singleWord.readingTime).toBe(1);

      // 400 words should be 2 mins
      const fourHundredWords = Array(400).fill('knowledge').join(' ');
      const metrics = notesRepository.computeTextMetrics(fourHundredWords);
      expect(metrics.wordCount).toBe(400);
      expect(metrics.readingTime).toBe(2);
    });
  });

  describe('Wiki-Link Autocomplete Query Matching', () => {
    it('filters matching candidate note titles by query string case-insensitively', () => {
      const candidates = [
        { id: 1, title: 'Artificial Intelligence' },
        { id: 2, title: 'Machine Learning' },
        { id: 3, title: 'Neural Networks' },
        { id: 4, title: 'Reinforcement Learning' }
      ];

      const filterNotes = (query: string) => {
        const q = query.toLowerCase().trim();
        return candidates.filter(n => n.title.toLowerCase().includes(q));
      };

      expect(filterNotes('learn').map(n => n.title)).toEqual(['Machine Learning', 'Reinforcement Learning']);
      expect(filterNotes('neural').map(n => n.title)).toEqual(['Neural Networks']);
      expect(filterNotes('xyz').length).toBe(0);
    });
  });
});
