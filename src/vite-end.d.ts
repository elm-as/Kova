/// <reference types="vite/client" />
interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
	readonly VITE_LLM_USE_SERVER_IN_DEV?: string
	readonly VITE_LLM_MODEL_DEFAULT?: string
	readonly VITE_LLM_MODEL_ANALYSIS?: string
	readonly VITE_LLM_MODEL_FAST?: string
	readonly VITE_LLM_MODEL_EMAIL?: string
}