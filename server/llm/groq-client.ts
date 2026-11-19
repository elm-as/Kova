export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionInput {
  prompt?: string;
  messages?: LlmMessage[];
  model?: string;
  jsonMode?: boolean;
}

export interface LlmRuntimeConfig {
  baseUrl: string;
  apiKeys: string[];
  defaultModel: string;
  systemPrompt: string;
}

let rotationCursor = 0;

/**
 * Parses a deduplicated list of server-side Groq/LLM keys from environment variables.
 */
export function resolveServerApiKeys(env: Record<string, string | undefined>): string[] {
  const rawList = [
    env.GROQ_API_KEYS,
    env.LLM_API_KEYS,
    env.GROQ_API_KEY,
    env.LLM_API_KEY,
  ]
    .filter(Boolean)
    .join(',');

  return Array.from(
    new Set(
      rawList
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 8),
    ),
  );
}

/**
 * Calls an OpenAI-compatible chat completion endpoint (Groq) with automatic key rotation on 429/401/5xx.
 */
export async function executeLlmWithRotation(
  input: LlmCompletionInput,
  config: LlmRuntimeConfig,
): Promise<{ content: string; modelUsed: string }> {
  if (config.apiKeys.length === 0) {
    throw new Error('Aucune clé GROQ_API_KEYS / LLM_API_KEY configurée côté serveur.');
  }

  const messages: LlmMessage[] =
    input.messages && input.messages.length > 0
      ? input.messages
      : input.prompt
        ? [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: input.prompt },
          ]
        : [];

  if (messages.length === 0) {
    throw new Error('Missing prompt or messages');
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const modelsToTry = Array.from(
    new Set([input.model || config.defaultModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']),
  );

  let lastError = 'LLM request failed';

  for (const model of modelsToTry) {
    const startIdx = rotationCursor % config.apiKeys.length;
    rotationCursor = (rotationCursor + 1) % config.apiKeys.length;

    for (let offset = 0; offset < config.apiKeys.length; offset += 1) {
      const apiKey = config.apiKeys[(startIdx + offset) % config.apiKeys.length];
      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: 0.4,
        max_tokens: 1800,
      };
      if (input.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35_000);
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const rawText = await resp.text();
        if (resp.ok) {
          const parsed = JSON.parse(rawText) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = parsed?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim()) {
            return { content, modelUsed: model };
          }
          lastError = 'Réponse LLM vide';
          continue;
        }

        lastError = `HTTP ${resp.status}: ${rawText.slice(0, 180)}`;
        if (resp.status === 404 || resp.status === 400) break;
      } catch (err: unknown) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err.message : 'Erreur réseau LLM';
      }
    }
  }

  throw new Error(lastError);
}
