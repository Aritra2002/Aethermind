/**
 * @file ai-provider-adapters.test.ts
 * @description Comprehensive unit test suite for modular AI provider adapters and client spoofing.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registry } from '../utils/ai/registry';
import { redactSecrets, getClientSpoofHeaders } from '../utils/ai/adapters/base';
import { OpenAIAdapter } from '../utils/ai/adapters/openai';
import { AnthropicAdapter } from '../utils/ai/adapters/anthropic';
import { GoogleAdapter } from '../utils/ai/adapters/google';
import type { AIConfig } from '../utils/ai/types';

describe('AI Provider Adapters & Client Spoofing Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Secret Redaction', () => {
    it('redacts various secret key patterns from error traces and strings', () => {
      const input = 'Error with sk-1234567890abcdef and x-api-key: secret_key_12345 and Bearer my_super_secret_token_12345';
      const redacted = redactSecrets(input);
      expect(redacted).not.toContain('sk-1234567890abcdef');
      expect(redacted).not.toContain('secret_key_12345');
      expect(redacted).not.toContain('my_super_secret_token_12345');
      expect(redacted).toContain('***[REDACTED]***');
    });
  });

  describe('Client Spoofing Headers', () => {
    it('generates correct headers for KiloCode emulation', () => {
      const config: AIConfig = {
        provider: 'custom',
        baseUrl: 'https://local-ollama:11434',
        apiKey: '',
        model: 'llama3',
        clientSpoof: 'kilocode'
      };
      const headers = getClientSpoofHeaders(config);
      expect(headers['User-Agent']).toContain('KiloCode');
      expect(headers['X-Client-Name']).toBe('KiloCode');
    });

    it('generates correct headers for Cursor and VSCode emulation', () => {
      const cursorConfig: AIConfig = {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        clientSpoof: 'cursor'
      };
      const cursorHeaders = getClientSpoofHeaders(cursorConfig);
      expect(cursorHeaders['User-Agent']).toBe('Cursor/0.40.0');
      expect(cursorHeaders['X-Cursor-Client']).toBe('true');

      const vscodeConfig: AIConfig = {
        ...cursorConfig,
        clientSpoof: 'vscode'
      };
      const vscodeHeaders = getClientSpoofHeaders(vscodeConfig);
      expect(vscodeHeaders['User-Agent']).toBe('VSCode/1.90.0');
    });

    it('supports custom JSON headers when clientSpoof is custom', () => {
      const config: AIConfig = {
        provider: 'custom',
        baseUrl: 'https://my-api.com',
        apiKey: '',
        model: 'test',
        clientSpoof: 'custom',
        customClientHeaders: {
          'X-Custom-Agent': 'SpecialAgent/2.0',
          'X-Tenant-ID': '12345'
        }
      };
      const headers = getClientSpoofHeaders(config);
      expect(headers['X-Custom-Agent']).toBe('SpecialAgent/2.0');
      expect(headers['X-Tenant-ID']).toBe('12345');
    });
  });

  describe('Adapter Registry', () => {
    it('correctly maps providers to their respective adapter instances', () => {
      expect(registry.get('openai')).toBeInstanceOf(OpenAIAdapter);
      expect(registry.get('deepseek')).toBeInstanceOf(OpenAIAdapter);
      expect(registry.get('openrouter')).toBeInstanceOf(OpenAIAdapter);
      expect(registry.get('custom')).toBeInstanceOf(OpenAIAdapter);
      expect(registry.get('anthropic')).toBeInstanceOf(AnthropicAdapter);
      expect(registry.get('google')).toBeInstanceOf(GoogleAdapter);
    });
  });

  describe('OpenAI Adapter Call & Stream Handling', () => {
    it('formats standard non-streaming requests properly', async () => {
      const adapter = new OpenAIAdapter();
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI generated knowledge response' } }]
        })
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const config: AIConfig = {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-mock-key',
        model: 'gpt-4o-mini',
        clientSpoof: 'kilocode'
      };

      const result = await adapter.call(config, {
        systemPrompt: 'You are an assistant',
        userPrompt: 'Hello world'
      });

      expect(result).toBe('AI generated knowledge response');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.headers['Authorization']).toBe('Bearer sk-mock-key');
      expect(options.headers['User-Agent']).toContain('KiloCode');
    });
  });

  describe('Anthropic Adapter Call', () => {
    it('constructs Claude messages format with anthropic headers', async () => {
      const adapter = new AnthropicAdapter();
      const mockResponse = {
        ok: true,
        json: async () => ({
          content: [{ text: 'Claude synthesized note' }]
        })
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const config: AIConfig = {
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        model: 'claude-3-5-sonnet-20240620'
      };

      const result = await adapter.call(config, {
        systemPrompt: 'System instruction',
        userPrompt: 'Synthesize content'
      });

      expect(result).toBe('Claude synthesized note');
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.headers['x-api-key']).toBe('sk-ant-test');
      expect(options.headers['anthropic-version']).toBe('2023-06-01');
    });
  });
});
