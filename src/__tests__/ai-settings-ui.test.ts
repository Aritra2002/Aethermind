import { describe, it, expect, beforeEach } from 'vitest';
import { getAIConfig, setAIConfig, DEFAULT_PROVIDER_BASE_URLS, DEFAULT_PROVIDER_MODELS } from '../utils/aiClient';
import type { AIConfig, AIProvider } from '../utils/ai/types';

describe('AI Settings UI & Base URL Configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Default Provider URLs and Models', () => {
    it('defines fixed base URLs for OpenAI, Anthropic, DeepSeek, Google, and OpenRouter', () => {
      expect(DEFAULT_PROVIDER_BASE_URLS.openai).toBe('https://api.openai.com/v1');
      expect(DEFAULT_PROVIDER_BASE_URLS.anthropic).toBe('https://api.anthropic.com');
      expect(DEFAULT_PROVIDER_BASE_URLS.deepseek).toBe('https://api.deepseek.com');
      expect(DEFAULT_PROVIDER_BASE_URLS.google).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
      expect(DEFAULT_PROVIDER_BASE_URLS.openrouter).toBe('https://openrouter.ai/api/v1');
    });

    it('defines empty base URLs for custom and vercel providers', () => {
      expect(DEFAULT_PROVIDER_BASE_URLS.custom).toBe('');
      expect(DEFAULT_PROVIDER_BASE_URLS.vercel).toBe('');
    });

    it('defines default flagship models for each provider', () => {
      expect(DEFAULT_PROVIDER_MODELS.openai).toBe('gpt-4o-mini');
      expect(DEFAULT_PROVIDER_MODELS.anthropic).toBe('claude-3-5-sonnet-20240620');
      expect(DEFAULT_PROVIDER_MODELS.deepseek).toBe('deepseek-chat');
      expect(DEFAULT_PROVIDER_MODELS.google).toBe('gemini-2.5-flash');
      expect(DEFAULT_PROVIDER_MODELS.openrouter).toBe('google/gemini-2.5-flash');
    });
  });

  describe('getAIConfig fallback resolution', () => {
    it('returns default OpenAI base URL and model when localStorage is empty', () => {
      const config = getAIConfig();
      expect(config.provider).toBe('openai');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('returns Anthropic default base URL and model when provider is anthropic with no custom baseUrl', () => {
      localStorage.setItem('aiProvider', 'anthropic');
      const config = getAIConfig();
      expect(config.provider).toBe('anthropic');
      expect(config.baseUrl).toBe('https://api.anthropic.com');
      expect(config.model).toBe('claude-3-5-sonnet-20240620');
    });

    it('returns Google default base URL when provider is google with no custom baseUrl', () => {
      localStorage.setItem('aiProvider', 'google');
      const config = getAIConfig();
      expect(config.provider).toBe('google');
      expect(config.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
      expect(config.model).toBe('gemini-2.5-flash');
    });

    it('preserves custom base URL if explicitly configured for custom provider', () => {
      const customConfig: AIConfig = {
        provider: 'custom',
        baseUrl: 'https://my-local-ollama:11434/v1',
        apiKey: 'local-key',
        model: 'llama3:8b'
      };
      setAIConfig(customConfig);
      const retrieved = getAIConfig();
      expect(retrieved.provider).toBe('custom');
      expect(retrieved.baseUrl).toBe('https://my-local-ollama:11434/v1');
      expect(retrieved.apiKey).toBe('local-key');
      expect(retrieved.model).toBe('llama3:8b');
    });
  });

  describe('Provider immutability classification', () => {
    const isCustomizable = (provider: AIProvider) => ['custom', 'vercel'].includes(provider);

    it('classifies custom and vercel as configurable base URL providers', () => {
      expect(isCustomizable('custom')).toBe(true);
      expect(isCustomizable('vercel')).toBe(true);
    });

    it('classifies standard built-in providers as fixed base URL providers', () => {
      const fixedProviders: AIProvider[] = ['openai', 'anthropic', 'deepseek', 'google', 'openrouter'];
      for (const p of fixedProviders) {
        expect(isCustomizable(p)).toBe(false);
      }
    });
  });
});
