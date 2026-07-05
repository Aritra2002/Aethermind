import React, { useState } from 'react';
import { getAIConfig, setAIConfig, detectModels } from '../../utils/aiClient';
import type { AIConfig } from '../../utils/aiClient';

export const AiSettingsTab: React.FC = () => {
  const [aiConfig, setLocalAIConfig] = useState<AIConfig>(() => getAIConfig());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [availableModels, setAvailableModels] = useState<{id: string; name?: string}[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleAiConfigChange = (key: keyof AIConfig, value: string) => {
    const newConfig = { ...aiConfig, [key]: value };
    setLocalAIConfig(newConfig);
    setAIConfig(newConfig);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

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
      console.error(e);
      alert((e as Error).message || "Failed to detect models. Please check your API key and Base URL.");
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>AI Integration</h3>
        {saveStatus === 'saved' && <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>Saved</span>}
      </div>
      <p className="section-desc">Configure your preferred AI provider for intelligent features.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Provider</label>
          <select
            value={aiConfig.provider || 'openai'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const newProvider = e.target.value as AIConfig['provider'];
              const newConfig = { ...aiConfig, provider: newProvider };
              if (newProvider === 'anthropic') { newConfig.baseUrl = 'https://api.anthropic.com'; newConfig.model = 'claude-3-5-sonnet-20240620'; }
              else if (newProvider === 'deepseek') { newConfig.baseUrl = 'https://api.deepseek.com'; newConfig.model = 'deepseek-chat'; }
              else if (newProvider === 'openai') { newConfig.baseUrl = 'https://api.openai.com/v1'; newConfig.model = 'gpt-4o-mini'; }
              else if (newProvider === 'google') { newConfig.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; newConfig.model = 'gemini-2.5-flash'; }
              else if (newProvider === 'openrouter') { newConfig.baseUrl = 'https://openrouter.ai/api/v1'; newConfig.model = 'google/gemini-2.5-flash'; }
              else if (newProvider === 'vercel') { newConfig.baseUrl = ''; newConfig.model = ''; }
              else { newConfig.baseUrl = ''; newConfig.model = ''; }
              
              setLocalAIConfig(newConfig);
              setAIConfig(newConfig);
            }}
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }}
          >
            <option value="anthropic" style={{ background: '#111827' }}>Anthropic</option>
            <option value="deepseek" style={{ background: '#111827' }}>DeepSeek</option>
            <option value="openai" style={{ background: '#111827' }}>OpenAI</option>
            <option value="google" style={{ background: '#111827' }}>Google</option>
            <option value="openrouter" style={{ background: '#111827' }}>OpenRouter</option>
            <option value="vercel" style={{ background: '#111827' }}>Vercel AI Gateway</option>
            <option value="custom" style={{ background: '#111827' }}>Custom Provider</option>
          </select>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {aiConfig.provider === 'anthropic' && 'Direct access to Claude models, including Pro and Max'}
            {aiConfig.provider === 'deepseek' && 'DeepSeek models for reasoning and coding tasks'}
            {aiConfig.provider === 'openai' && 'GPT and Codex models with API key'}
            {aiConfig.provider === 'google' && 'Gemini models for fast, structured responses'}
            {aiConfig.provider === 'openrouter' && 'Access all supported models from one provider'}
            {aiConfig.provider === 'vercel' && 'Unified access to AI models with smart routing'}
            {aiConfig.provider === 'custom' && 'Add a custom OpenAI-compatible provider by base URL.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Base URL</label>
          <input
            type="text"
            value={aiConfig.baseUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('baseUrl', e.target.value)}
            placeholder={
              aiConfig.provider === 'custom' ? "https://your-custom-endpoint/v1" :
              aiConfig.provider === 'vercel' ? "https://gateway.ai.vercel.com/v1/..." : ""
            }
            disabled={!['custom', 'vercel'].includes(aiConfig.provider)}
            style={{ 
              background: ['custom', 'vercel'].includes(aiConfig.provider) ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              padding: '8px', 
              borderRadius: '4px', 
              color: ['custom', 'vercel'].includes(aiConfig.provider) ? '#fff' : 'var(--text-secondary)'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API Key</label>
          <input
            type="password"
            value={aiConfig.apiKey || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('apiKey', e.target.value)}
            placeholder="Enter your API key..."
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff' }}
          />
        </div>

        {aiConfig.provider === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Backend Proxy URL (Optional)</label>
            <input
              type="text"
              value={aiConfig.proxyUrl || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('proxyUrl', e.target.value)}
              placeholder="https://your-proxy.onrender.com (Direct connection if empty)"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Model</label>
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
            <select
              value={aiConfig.model || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAiConfigChange('model', e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff' }}
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id} style={{ background: '#111827' }}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={aiConfig.model || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAiConfigChange('model', e.target.value)}
              placeholder={aiConfig.provider === 'vercel' ? 'e.g. openai:gpt-4o' : (aiConfig.provider === 'openrouter' ? 'e.g. google/gemini-2.5-flash' : 'e.g. custom-model-name')}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
