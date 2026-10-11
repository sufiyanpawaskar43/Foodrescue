export { SUPABASE_URL, SUPABASE_KEY } from '../services/auth.js';
export { getStoredSession, signIn, signUp, refreshSession, getUser, signOut, clearSession } from '../services/auth.js';
export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY));
