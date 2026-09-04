/**
 * ============================================================================
 * AiSettingsTab.tsx — AI Provider Configuration & Model Discovery
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides the settings interface for configuring LLM integrations in AetherMind.
 * Allows users to choose between preset cloud providers (OpenAI, Anthropic, Google,
 * DeepSeek, OpenRouter, Vercel AI Gateway) or configure custom OpenAI-compatible
 * endpoints (e.g., LocalAI, Ollama, vLLM, self-hosted proxies).
 * 
 * Key Features:
 * - Multi-provider configuration with intelligent default base URLs and recommended models.
 * - Dynamic model detection querying the `/models` endpoint of OpenAI-compatible APIs.
 * - Real-time persistence to local storage / AI client configuration state.
 * - Transient visual save confirmations ("Saved" badge indicator).
 * - Optional backend proxy routing support for CORS-restricted or local environments.
 */

import React, { useState } from 'react';
import { getAIConfig, setAIConfig, detectModels, DEFAULT_PROVIDER_BASE_URLS, DEFAULT_PROVIDER_MODELS } from '../../utils/aiClient';
import type { AIConfig } from '../../utils/aiClient';
import { Dropdown } from '../ui/Dropdown';
import { Eye, EyeOff, Zap, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

/**
 * Recommended and common example models per provider for quick selection and placeholder hints.
 */
const PROVIDER_EXAMPLE_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  google: ['gemini-2.5-flash', 'gemini-1.5-pro'],
  openrouter: ['google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1'],
  vercel: ['openai:gpt-4o', 'anthropic:claude-3-5-sonnet'],
  custom: ['llama3.2:3b', 'mistral-large', 'qwen2.5-coder:7b']
};

/**
 * AiSettingsTab Component
 * 
 * Renders the AI settings panel inside the Settings modal.
 * Manages provider selection, API credentials, custom base URLs,
 * and automated model discovery.
 * 
 * @returns {React.ReactElement} The AI integration settings form.
 */
export const AiSettingsTab: React.FC = () => {
  /** Local copy of the active AI configuration loaded from client storage */
  const [aiConfig, setLocalAIConfig] = useState<AIConfig>(() => getAIConfig());

  /** Transient visual state indicating recent configuration save status */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  /** List of dynamically discovered models retrieved from the provider's /models endpoint */
  const [availableModels, setAvailableModels] = useState<{ id: string; name?: string }[]>([]);

  /** Loading flag active during remote model discovery requests */
  const [isDetecting, setIsDetecting] = useState(false);

  /** Visibility toggle for API key input masking */
  const [showApiKey, setShowApiKey] = useState(false);

  /** Real-time latency and connection test status */
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    latency?: number;
    error?: string;
  }>({ testing: false });

  /**
   * Tests active provider endpoint connection and measures latency.
   */
  const handleTestConnection = async () => {
    if (!aiConfig.baseUrl) return;
    setTestStatus({ testing: true });
    const start = performance.now();
    try {
      await detectModels(aiConfig.baseUrl, aiConfig.apiKey);
      const latency = Math.round(performance.now() - start);
      setTestStatus({ testing: false, latency });
    } catch (e: unknown) {
      setTestStatus({
        testing: false,
        error: e instanceof Error ? e.message : 'Connection test failed'
      });
    }
  };

  /**
   * Updates a specific field within the AI configuration, immediately writes
   * changes to persistent storage, and displays a temporary save badge.
   * 
   * @param {keyof AIConfig} key - The property key in AIConfig to update.
   * @param {string} value - The new string value for the specified configuration key.
   */
  const handleAiConfigChange = (key: keyof AIConfig, value: string) => {
    const newConfig = { ...aiConfig, [key]: value };
    setLocalAIConfig(newConfig);
    setAIConfig(newConfig);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  /**
   * Probes the configured base URL and API key to fetch available models.
   * If models are discovered and no model is currently selected, the first
   * detected model is automatically selected as default.
   */
  const handleDetectModels = async () => {
    if (!aiConfig.baseUrl) return;
    setIsDetecting(true);
    try {
      const models = await detectModels(aiConfig.baseUrl, aiConfig.apiKey);
      setAvailableModels(models);
      if (models.length > 0 && !aiConfig.model) {
        handleAiConfigChange('model', models[0].id);
      }
    } catch (e: unknown) {
      console.error('Model detection failed:', e);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="settings-section">
      {/* Header with section title and live save badge */}
      <div className="d-flex align-items-center justify-content-between">
        <h3>AI Integration</h3>
        {saveStatus === 'saved' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--node-emerald, #34d399)' }}>
            Saved
          </span>
        )}
      </div>
      <p className="section-desc">Configure your preferred AI provider for intelligent features.</p>
      
      <div className="d-flex flex-column gap-3 mt-3">
        {/* Provider Selection Dropdown */}
        <div className="mb-3">
          <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Provider
          </label>
          <Dropdown
            value={aiConfig.provider || 'openai'}
            onChange={(val) => {
              const newProvider = val as AIConfig['provider'];
              const newConfig = { ...aiConfig, provider: newProvider };

              // Apply recommended base URLs and default flagship models per provider
              newConfig.baseUrl = DEFAULT_PROVIDER_BASE_URLS[newProvider] || '';
              newConfig.model = DEFAULT_PROVIDER_MODELS[newProvider] || '';
              
              setLocalAIConfig(newConfig);
              setAIConfig(newConfig);
            }}
            options={[
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'google', label: 'Google' },
              { value: 'openrouter', label: 'OpenRouter' },
              { value: 'vercel', label: 'Vercel AI Gateway' },
              { value: 'custom', label: 'Custom Provider' }
            ]}
          />
          <div className="form-text" style={{ fontSize: '0.8rem' }}>
            {aiConfig.provider === 'anthropic' && 'Direct access to Claude models, including Pro and Max'}
            {aiConfig.provider === 'deepseek' && 'DeepSeek models for reasoning and coding tasks'}
            {aiConfig.provider === 'openai' && 'GPT and Codex models with API key'}
            {aiConfig.provider === 'google' && 'Gemini models for fast, structured responses'}
            {aiConfig.provider === 'openrouter' && 'Access all supported models from one provider'}
            {aiConfig.provider === 'vercel' && 'Unified access to AI models with smart routing'}
            {aiConfig.provider === 'custom' && 'Add a custom OpenAI-compatible provider by base URL.'}
          </div>
        </div>

        {/* Base URL Input */}
        {(() => {
          const isFixedProvider = !['custom', 'vercel'].includes(aiConfig.provider);
          const displayBaseUrl = isFixedProvider
            ? (DEFAULT_PROVIDER_BASE_URLS[aiConfig.provider] || '')
            : (aiConfig.baseUrl || '');

          return (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label mb-0" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Base URL
                </label>
                {isFixedProvider ? (
                  <span className="badge d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem', background: 'var(--surface-badge-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <Lock size={10} />
                    Fixed Endpoint
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                    Editable Endpoint
                  </span>
                )}
              </div>
              <input
                type="text"
                className="form-control"
                value={displayBaseUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!isFixedProvider) {
                    handleAiConfigChange('baseUrl', e.target.value);
                  }
                }}
                placeholder={
                  aiConfig.provider === 'custom'
                    ? "https://your-custom-endpoint/v1 (e.g. http://localhost:11434/v1)"
                    : aiConfig.provider === 'vercel'
                    ? "https://gateway.ai.vercel.com/v1"
                    : (DEFAULT_PROVIDER_BASE_URLS[aiConfig.provider] || "https://api.openai.com/v1")
                }
                readOnly={isFixedProvider}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  cursor: isFixedProvider ? 'default' : 'text'
                }}
              />
              <div className="form-text mt-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isFixedProvider ? (
                  `Pre-configured standard endpoint for ${aiConfig.provider}. Select "Custom Provider" to specify a custom base URL.`
                ) : aiConfig.provider === 'vercel' ? (
                  'Enter your Vercel AI Gateway endpoint URL (e.g. https://gateway.ai.vercel.com/v1).'
                ) : (
                  'Specify any OpenAI-compatible API base URL (e.g. http://localhost:11434/v1 for local Ollama, or vLLM).'
                )}
              </div>
            </div>
          );
        })()}

        {/* API Key Input with OriginUI password reveal toggle */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label mb-0" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              API Key
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {aiConfig.provider === 'anthropic' ? 'sk-ant-...' :
               aiConfig.provider === 'google' ? 'AIzaSy...' :
               aiConfig.provider === 'openrouter' ? 'sk-or-...' :
               'sk-...'}
            </span>
          </div>
          <div className="position-relative d-flex align-items-center">
            <input
              type={showApiKey ? "text" : "password"}
              className="form-control"
              style={{ paddingRight: '40px', fontFamily: showApiKey ? 'var(--font-mono)' : 'inherit' }}
              value={aiConfig.apiKey || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('apiKey', e.target.value)}
              placeholder={
                aiConfig.provider === 'anthropic'
                  ? 'sk-ant-api03-...'
                  : aiConfig.provider === 'google'
                  ? 'AIzaSy...'
                  : aiConfig.provider === 'openrouter'
                  ? 'sk-or-v1-...'
                  : 'sk-proj-...'
              }
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="btn btn-ghost btn-sm position-absolute end-0 me-1"
              style={{ padding: '4px 8px', color: 'var(--text-muted)' }}
              title={showApiKey ? "Hide API Key" : "Show API Key"}
              aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
            >
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Optional Backend Proxy URL for Custom Providers */}
        {aiConfig.provider === 'custom' && (
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Backend Proxy URL (Optional)
            </label>
            <input
              type="text"
              className="form-control"
              value={aiConfig.proxyUrl || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('proxyUrl', e.target.value)}
              placeholder="https://your-proxy.onrender.com (Direct connection if empty)"
            />
          </div>
        )}

        {/* Model Selection & Auto-Detection with Test Connection */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
            <label className="form-label mb-0" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Model
            </label>
            <div className="d-flex align-items-center gap-2">
              {/* Test Connection Button */}
              <button
                type="button"
                className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-1"
                onClick={handleTestConnection}
                disabled={testStatus.testing || !aiConfig.baseUrl}
                style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--text-secondary)' }}
                title="Ping endpoint to test connectivity"
              >
                <Zap size={13} style={{ color: 'var(--accent-gold, #f59e0b)' }} />
                <span>{testStatus.testing ? 'Testing...' : 'Test Connection'}</span>
              </button>

              {testStatus.latency !== undefined && (
                <span className="badge d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--node-emerald, #10b981)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <CheckCircle2 size={11} />
                  <span>{testStatus.latency}ms</span>
                </span>
              )}

              {testStatus.error && (
                <span className="badge d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem', background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-danger, #f43f5e)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  <AlertCircle size={11} />
                  <span>Failed</span>
                </span>
              )}

              {['custom', 'openrouter', 'openai', 'deepseek'].includes(aiConfig.provider) && (
                <button 
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleDetectModels}
                  disabled={isDetecting || !aiConfig.baseUrl}
                  style={{ color: 'var(--accent-primary)', padding: '2px 8px', fontSize: '0.75rem' }}
                >
                  {isDetecting ? 'Detecting...' : 'Detect Models'}
                </button>
              )}
            </div>
          </div>
          
          {['custom', 'openrouter', 'openai', 'deepseek'].includes(aiConfig.provider) && availableModels.length > 0 ? (
            <Dropdown
              isSearchable={true}
              value={aiConfig.model || ''}
              onChange={(val) => handleAiConfigChange('model', val as string)}
              options={availableModels.map(m => ({ value: m.id, label: m.name || m.id }))}
            />
          ) : (
            <input
              type="text"
              className="form-control"
              value={aiConfig.model || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('model', e.target.value)}
              placeholder={
                aiConfig.provider === 'openai'
                  ? 'e.g. gpt-4o, gpt-4o-mini'
                  : aiConfig.provider === 'anthropic'
                  ? 'e.g. claude-3-5-sonnet-20240620'
                  : aiConfig.provider === 'deepseek'
                  ? 'e.g. deepseek-chat, deepseek-reasoner'
                  : aiConfig.provider === 'google'
                  ? 'e.g. gemini-2.5-flash, gemini-1.5-pro'
                  : aiConfig.provider === 'openrouter'
                  ? 'e.g. google/gemini-2.5-flash'
                  : aiConfig.provider === 'vercel'
                  ? 'e.g. openai:gpt-4o'
                  : 'e.g. llama3:8b, mistral-large'
              }
            />
          )}

          {/* Quick Model Recommendation Pills */}
          <div className="d-flex align-items-center gap-1 flex-wrap mt-2">
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Examples:</span>
            {PROVIDER_EXAMPLE_MODELS[aiConfig.provider]?.map((ex) => (
              <button
                key={ex}
                type="button"
                className="btn btn-ghost p-0 px-2 py-1"
                onClick={() => handleAiConfigChange('model', ex)}
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  background: aiConfig.model === ex ? 'var(--glow-primary, rgba(0, 242, 254, 0.15))' : 'var(--surface-badge-bg)',
                  border: aiConfig.model === ex ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  color: aiConfig.model === ex ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                title={`Select ${ex}`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Client Spoofing Profile (Kilo Code, Cursor, Continue, VSCode, None, Custom) */}
        <div className="mb-3">
          <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Client Spoofing / Emulation (Optional)
          </label>
          <Dropdown
            value={aiConfig.clientSpoof || 'none'}
            onChange={(val) => handleAiConfigChange('clientSpoof', val as string)}
            options={[
              { value: 'none', label: 'Default (AetherMind Standard)' },
              { value: 'kilocode', label: 'Kilo Code (Emulate KiloCode client)' },
              { value: 'cursor', label: 'Cursor (Emulate Cursor IDE)' },
              { value: 'continue', label: 'Continue.dev (Emulate Continue extension)' },
              { value: 'vscode', label: 'VS Code Copilot (Emulate VS Code)' },
              { value: 'custom', label: 'Custom Headers (JSON)' }
            ]}
          />
          <div className="form-text" style={{ fontSize: '0.8rem' }}>
            Spoofs headers like User-Agent and client identifiers for compatible backend endpoints and routing gateways.
          </div>
        </div>

        {aiConfig.clientSpoof === 'custom' && (
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Custom Headers (JSON Object)
            </label>
            <textarea
              className="form-control"
              rows={3}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              value={aiConfig.customClientHeaders ? JSON.stringify(aiConfig.customClientHeaders, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : undefined;
                  const newConfig = { ...aiConfig, customClientHeaders: parsed };
                  setLocalAIConfig(newConfig);
                  setAIConfig(newConfig);
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 2000);
                } catch {
                  // Keep typing in local state
                }
              }}
              placeholder='{\n  "X-Custom-Client": "MyClient/1.0",\n  "User-Agent": "MyAgent/1.0"\n}'
            />
          </div>
        )}
      </div>
    </div>
  );
};