import { executeLlmWithRotation, resolveServerApiKeys } from '../../server/llm/groq-client';
import { checkRateLimit, rateLimitResponse, getClientIp } from './shared/rate-limit';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const rl = checkRateLimit(getClientIp(event), 25, 60_000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetAt);
  }

  let body: Record<string, unknown>;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const apiKeys = resolveServerApiKeys(process.env);
  if (apiKeys.length === 0) {
    return json(500, { error: 'GROQ_API_KEYS / LLM_API_KEY is not configured.' });
  }

  try {
    const result = await executeLlmWithRotation(body, {
      baseUrl: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKeys,
      defaultModel: process.env.LLM_MODEL_DEFAULT || 'openai/gpt-oss-120b',
      systemPrompt: process.env.LLM_SYSTEM_PROMPT || 'You are a helpful recruitment and career analyst.',
    });
    return json(200, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'LLM proxy error';
    return json(502, { error: message });
  }
};
