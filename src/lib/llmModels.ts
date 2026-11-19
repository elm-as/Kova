/**
 * Centralized LLM model name resolution.
 * Avoids duplicating `import.meta.env.VITE_LLM_MODEL_*` across the codebase.
 */

export function getLLMModel(purpose: 'default' | 'analysis' | 'fast' | 'email' = 'default'): string {
  const defaultModel = import.meta.env.VITE_LLM_MODEL_DEFAULT || 'deepseek-chat'
  const fastDefault = import.meta.env.VITE_LLM_MODEL_FAST || 'llama-3.1-8b-instant'

  switch (purpose) {
    case 'analysis':
      return import.meta.env.VITE_LLM_MODEL_ANALYSIS || defaultModel
    case 'fast':
      return fastDefault
    case 'email':
      return import.meta.env.VITE_LLM_MODEL_EMAIL || defaultModel
    default:
      return defaultModel
  }
}
