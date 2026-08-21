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
import { getAIConfig, setAIConfig, detectModels } from '../../utils/aiClient';
import type { AIConfig } from '../../utils/aiClient';
import { Dropdown } from '../ui/Dropdown';

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
              if (newProvider === 'anthropic') {
                newConfig.baseUrl = 'https://api.anthropic.com';
                newConfig.model = 'claude-3-5-sonnet-20240620';
              } else if (newProvider === 'deepseek') {
                newConfig.baseUrl = 'https://api.deepseek.com';
                newConfig.model = 'deepseek-chat';
              } else if (newProvider === 'openai') {
                newConfig.baseUrl = 'https://api.openai.com/v1';
                newConfig.model = 'gpt-4o-mini';
              } else if (newProvider === 'google') {
                newConfig.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
                newConfig.model = 'gemini-2.5-flash';
              } else if (newProvider === 'openrouter') {
                newConfig.baseUrl = 'https://openrouter.ai/api/v1';
                newConfig.model = 'google/gemini-2.5-flash';
              } else if (newProvider === 'vercel') {
                newConfig.baseUrl = '';
                newConfig.model = '';
              } else {
                newConfig.baseUrl = '';
                newConfig.model = '';
              }
              
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
        <div className="mb-3">
          <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Base URL
          </label>
          <input
            type="text"
            className="form-control"
            value={aiConfig.baseUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('baseUrl', e.target.value)}
            placeholder={
              aiConfig.provider === 'custom' ? "https://your-custom-endpoint/v1" :
              aiConfig.provider === 'vercel' ? "https://gateway.ai.vercel.com/v1/..." : ""
            }
            disabled={!['custom', 'vercel'].includes(aiConfig.provider)}
          />
        </div>

        {/* API Key Input */}
        <div className="mb-3">
          <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            API Key
          </label>
          <input
            type="password"
            className="form-control"
            value={aiConfig.apiKey || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('apiKey', e.target.value)}
            placeholder="Enter your API key..."
          />
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

        {/* Model Selection & Auto-Detection */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Model
            </label>
            {['custom', 'openrouter', 'openai', 'deepseek'].includes(aiConfig.provider) && (
              <button 
                className="btn btn-ghost btn-sm"
                onClick={handleDetectModels}
                disabled={isDetecting || !aiConfig.baseUrl}
                style={{ color: 'var(--accent-primary)', padding: '2px 8px' }}
              >
                {isDetecting ? 'Detecting...' : 'Detect Models'}
              </button>
            )}
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
                aiConfig.provider === 'vercel'
                  ? 'e.g. openai:gpt-4o'
                  : aiConfig.provider === 'openrouter'
                  ? 'e.g. google/gemini-2.5-flash'
                  : 'e.g. custom-model-name'
              }
            />
          )}
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