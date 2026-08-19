/**
 * @file aiClient.ts
 * @description Multi-provider AI client for AetherMind.
 * Provides unified interface and streaming abstractions for interacting with diverse LLM providers
 * including OpenAI, Anthropic Claude, Google Gemini, DeepSeek, OpenRouter, Vercel AI Gateway,
 * and custom OpenAI-compatible local/remote endpoints (e.g., Ollama, LM Studio, AgentRouter).
 * Supports token streaming, abort signals, CORS proxy forwarding, and model detection.
 */

/**
 * Supported LLM provider identifiers.
 */
export type AIProvider = 'anthropic' | 'deepseek' | 'openai' | 'google' | 'openrouter' | 'vercel' | 'custom';

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
}

/**
 * Retrieves the current AI configuration from browser `localStorage` with provider-specific defaults.
 *
 * @returns The resolved {@link AIConfig} object containing provider, baseUrl, apiKey, and model.
 */
export const getAIConfig = (): AIConfig => {
  const provider = (localStorage.getItem('aiProvider') as AIProvider) || 'openai';
  const defaultBaseUrl: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    openrouter: 'https://openrouter.ai/api/v1',
  };
  const defaultModel: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20240620',
    deepseek: 'deepseek-chat',
    google: 'gemini-2.5-flash',
    openrouter: 'google/gemini-2.5-flash',
  };
  return {
    provider,
    baseUrl: localStorage.getItem('aiBaseUrl') || defaultBaseUrl[provider] || '',
    apiKey: localStorage.getItem('aiApiKey') || '',
    model: localStorage.getItem('aiModel') || defaultModel[provider] || '',
  };
};

/**
 * Persists updated AI connection settings into browser `localStorage`.
 *
 * @param config - The {@link AIConfig} parameters to store.
 */
export const setAIConfig = (config: AIConfig) => {
  localStorage.setItem('aiProvider', config.provider);
  localStorage.setItem('aiBaseUrl', config.baseUrl);
  localStorage.setItem('aiApiKey', config.apiKey);
  localStorage.setItem('aiModel', config.model);
};

/**
 * Dispatches a prompt to the configured AI provider with optional real-time token streaming.
 * Handles provider-specific request payload formatting, header configuration, CORS proxy routing,
 * Server-Sent Events (SSE) decoding, and Ollama/CORS error diagnostics.
 *
 * @param systemPrompt - System prompt defining model persona, formatting constraints, and tools.
 * @param userPrompt - User query or input prompt.
 * @param onStream - Optional streaming callback receiving cumulative or delta text as chunks arrive.
 * @param signal - Optional {@link AbortSignal} to cancel in-flight HTTP network requests.
 *
 * @returns A promise resolving to the complete response text from the LLM.
 *
 * @throws {Error} If required API keys or base URLs are missing, if authentication fails (401),
 *                 if the provider returns an HTTP error, or if network connectivity is severed.
 */
export const callAI = async (
  systemPrompt: string,
  userPrompt: string,
  onStream?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const config = getAIConfig();
  if (!config.apiKey && config.provider !== 'custom') {
    throw new Error('API Key is missing. Please add it in Settings.');
  }
  // If provider is not custom, baseUrl might be empty but we can fallback. However, for custom, baseUrl is required.
  if (config.provider === 'custom' && !config.baseUrl) {
    throw new Error('Base URL is missing for Custom Provider.');
  }

  const isCustom = config.provider === 'custom';
  
  // Normalize the URL in case the user missed the // (e.g., http:localhost:1234)
  let endpoint = config.baseUrl;
  if (endpoint && endpoint.startsWith('http:') && !endpoint.startsWith('http://')) {
    endpoint = endpoint.replace('http:', 'http://');
  } else if (endpoint && endpoint.startsWith('https:') && !endpoint.startsWith('https://')) {
    endpoint = endpoint.replace('https:', 'https://');
  }

  // Resolve default endpoints if no custom base URL is specified
  if (!endpoint && !isCustom) {
    switch (config.provider) {
      case 'anthropic': endpoint = 'https://api.anthropic.com/v1/messages'; break;
      case 'deepseek': endpoint = 'https://api.deepseek.com/v1/chat/completions'; break;
      case 'openai': endpoint = 'https://api.openai.com/v1/chat/completions'; break;
      case 'google': endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + config.model + ':streamGenerateContent'; break;
      case 'openrouter': endpoint = 'https://openrouter.ai/api/v1/chat/completions'; break;
      case 'vercel': endpoint = 'https://gateway.ai.vercel.com/v1/chat/completions'; break;
      default: endpoint = 'https://api.openai.com/v1/chat/completions';
    }
  } else if (endpoint) {
    // Append standard paths if the user just provided the server origin
    if (config.provider === 'anthropic' && !endpoint.includes('/v1/messages')) endpoint = endpoint.replace(/\/?$/, '') + '/v1/messages';
    else if (config.provider === 'google' && !endpoint.includes(':streamGenerateContent') && !endpoint.includes('/chat/completions')) {
      endpoint = endpoint.replace(/\/?$/, '') + '/models/' + (config.model || 'gemini-2.5-flash') + ':streamGenerateContent';
    }
    else if (config.provider !== 'google' && !endpoint.includes('/chat/completions')) {
      if (endpoint.match(/\/v1\/?$/)) {
        endpoint = endpoint.replace(/\/?$/, '') + '/chat/completions';
      } else {
        endpoint = endpoint.replace(/\/?$/, '') + '/v1/chat/completions';
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let bodyPayload: Record<string, unknown>;

  // Build provider-specific request headers and JSON payloads
  if (config.provider === 'anthropic') {
    if (config.apiKey) headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerously-allow-browser'] = 'true';
    bodyPayload = {
      model: config.model || 'claude-3-5-sonnet-20240620',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      stream: !!onStream,
      max_tokens: 1024
    };
  } else if (config.provider === 'google') {
    if (config.apiKey) headers['x-goog-api-key'] = config.apiKey;
    bodyPayload = {
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }]
    };
  } else {
    // Default OpenAI-compatible format (OpenAI, DeepSeek, OpenRouter, Custom, etc.)
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'AetherMind';
    }
    
    if (isCustom) {
      if (config.proxyUrl || config.baseUrl.includes('agentrouter')) {
        // Spoof client identification headers for custom provider gateways (e.g. AgentRouter)
        headers['HTTP-Referer'] = 'https://github.com/RooVetGit/Roo-Code'; 
        headers['X-Title'] = 'Roo Code';
        headers['User-Agent'] = 'Roo-Code';
        headers['Originator'] = 'codex_cli_rs'; // Required by AgentRouter
      } else if (config.baseUrl.includes('openrouter')) {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'AetherMind';
      }
    }
    bodyPayload = {
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: !!onStream,
    };
  }

  try {
    let fetchUrl = endpoint;
    let fetchHeaders = headers;
    let fetchBody = JSON.stringify(bodyPayload);

    // Route request through custom backend proxy if configured to bypass browser CORS restrictions
    if (isCustom && config.proxyUrl) {
      const baseProxyUrl = config.proxyUrl.replace(/\/+$/, "");
      
      fetchUrl = `${baseProxyUrl}/api/ai/proxy`;
      fetchHeaders = { 'Content-Type': 'application/json' };
      fetchBody = JSON.stringify({
        url: endpoint,
        headers,
        body: bodyPayload
      });
    }

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: fetchBody,
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed (401 Unauthorized). Please ensure you have provided a valid API Key in the settings.");
      }
      const errorText = await response.text();
      throw new Error(`AI API Error (${response.status}): ${errorText}`);
    }

    // Process streaming responses when onStream callback is supplied
    if (onStream) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';

      if (!reader) throw new Error('Response body is not readable');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Parse Google Gemini SSE chunks
        if (config.provider === 'google') {
           const textMatches = chunk.match(/"text":\s*"([^"]*)"/g);
           if (textMatches) {
             for (const match of textMatches) {
               try {
                 const text = JSON.parse('{' + match + '}').text;
                 fullContent += text;
                 onStream(fullContent);
               } catch {
                 try {
                   // Fallback for malformed chunks (e.g. unescaped newlines)
                   const sanitizedMatch = match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                   const text = JSON.parse('{' + sanitizedMatch + '}').text;
                   fullContent += text;
                   onStream(fullContent);
                 } catch (e2) {
                   console.debug(e2);
                 }
               }
             }
           }
        } else {
          // Parse OpenAI / Anthropic SSE streams
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                
                if (config.provider === 'anthropic') {
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    fullContent += parsed.delta.text;
                    onStream(fullContent);
                  }
                } else {
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    fullContent += delta;
                    onStream(fullContent);
                  }
                }
              } catch (e) {
                console.debug(e);
              }
            }
          }
        }
      }
      return fullContent;
    } else {
      // Non-streaming response parsing
      const data = await response.json();
      if (config.provider === 'anthropic') return data.content?.[0]?.text || '';
      if (config.provider === 'google') return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return data.choices?.[0]?.message?.content || '';
    }
  } catch (error: unknown) {
    if (import.meta.env.DEV) console.error('AI call failed:', error);
    // Provide actionable diagnostic message for local Ollama instances blocked by CORS
    if (error instanceof TypeError && error.message === 'Failed to fetch' && endpoint.includes('11434')) {
      throw new Error('Failed to connect to Ollama. This is likely a CORS issue. Please restart Ollama with the environment variable OLLAMA_ORIGINS="*" or "https://aritra2002.github.io". Original error: ' + String(error));
    }
    throw error;
  }
};

/**
 * Discovers available models from an OpenAI-compatible endpoint via the standard `/v1/models` route.
 * Supports direct requests as well as proxied requests to bypass browser CORS constraints.
 *
 * @param baseUrl - Base endpoint URL of the LLM service.
 * @param apiKey - Optional API token for authorization.
 *
 * @returns A promise resolving to an array of discovered model objects `{ id: string; name?: string }`.
 */
export async function detectModels(baseUrl: string, apiKey?: string): Promise<{ id: string; name?: string }[]> {
  try {
    let base = baseUrl.replace(/\/+$/, "");
    if (base && base.startsWith('http:') && !base.startsWith('http://')) base = base.replace('http:', 'http://');
    else if (base && base.startsWith('https:') && !base.startsWith('https://')) base = base.replace('https:', 'https://');
    
    // Strip common suffixes so we can append /models correctly
    base = base.replace(/\/chat\/completions$/, '');
    base = base.replace(/\/v1$/, '');

    const modelsUrl = `${base}/v1/models`;
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    
    const proxyUrl = localStorage.getItem('aiProxyUrl') || '';

    if (proxyUrl || base.includes('agentrouter')) {
      // Spoof headers for custom provider (e.g. AgentRouter)
      headers['HTTP-Referer'] = 'https://github.com/RooVetGit/Roo-Code'; 
      headers['X-Title'] = 'Roo Code';
      headers['User-Agent'] = 'Roo-Code';
      headers['Originator'] = 'codex_cli_rs'; // Required by AgentRouter
    } else if (base.includes('openrouter')) {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'AetherMind';
    }

    let fetchPromise;
    if (proxyUrl) {
      const baseProxyUrl = proxyUrl.replace(/\/+$/, "");
      fetchPromise = fetch(`${baseProxyUrl}/api/ai/proxy/get`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: modelsUrl, headers })
      });
    } else {
      // If no proxyUrl, fetch directly
      fetchPromise = fetch(modelsUrl, {
        method: 'GET',
        headers
      });
    }

    const response = await fetchPromise;

    if (response.status === 404) {
      // Many proxy providers don't implement /v1/models
      return [];
    }
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed (401 Unauthorized). Please ensure you have provided a valid API Key in the settings.");
      }
      const err = await response.json().catch(() => null);
      throw new Error(`AI API Error (${response.status}): ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: { id: string; name?: string }) => ({
        id: m.id,
        name: m.name,
      }));
    }
    return [];
  } catch {
    return [];
  }
}


