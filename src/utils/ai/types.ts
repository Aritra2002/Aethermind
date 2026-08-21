/**
 * @file types.ts
 * @description Core types and interfaces for the modular AI client subsystem in AetherMind.
 */

/**
 * Supported LLM provider identifiers.
 */
export type AIProvider = 'anthropic' | 'deepseek' | 'openai' | 'google' | 'openrouter' | 'vercel' | 'custom';

/**
 * Preset client spoofing profile identifiers.
 */
export type ClientSpoofProfile = 'none' | 'kilocode' | 'cursor' | 'continue' | 'vscode' | 'custom';

/**
 * Configuration settings for the active AI connection.
 */
export interface AIConfig {
  /** The selected LLM provider backend. */
  provider: AIProvider;
  /** Base API endpoint URL for the provider. */
  baseUrl: string;
  /** Secret API authentication token or key. */
  apiKey: string;
  /** Model identifier string (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-20240620', 'gemini-2.5-flash'). */
  model: string;
  /** Optional custom proxy gateway URL for bypassing browser CORS restrictions. */
  proxyUrl?: string;
  /** Optional client spoofing profile to emulate various AI client headers. */
  clientSpoof?: ClientSpoofProfile;
  /** Optional custom headers dictionary when clientSpoof is 'custom'. */
  customClientHeaders?: Record<string, string>;
}

/**
 * Standard chat message representation.
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Real-time streaming token callback receiving accumulated text.
 */
export type AIStreamCallback = (accumulatedText: string, delta?: string) => void;

/**
 * Request options for AI model completion calls.
 */
export interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  onStream?: AIStreamCallback;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Standardized model discovery item.
 */
export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  contextWindow?: number;
}

/**
 * Interface that all provider adapters must implement.
 */
export interface AIProviderAdapter {
  readonly id: AIProvider;
  call(config: AIConfig, options: AIRequestOptions): Promise<string>;
  detectModels?(config?: AIConfig): Promise<ModelInfo[]>;
}
