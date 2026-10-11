const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const STORAGE_KEY = 'foodrescue:auth';
let refreshInFlightToken = null;
let refreshInFlightPromise = null;

function headers(accessToken, extra = {}) {
  const base = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
  // A publishable key is an API key, not a JWT. Never send it as a Bearer token.
  if (accessToken) base.Authorization = `Bearer ${accessToken}`;
  return base;
}

async function authRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: headers(options.accessToken, options.headers),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.msg || body?.message || body?.error_description || body?.error || text || `Supabase Auth error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.code || body?.error_code || body?.errorCode;
    throw error;
  }
  return body;
}

export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function storeSession(session) {
  if (session) {
    const normalized = { ...session };
    if (!normalized.expires_at && normalized.expires_in) normalized.expires_at = Math.floor(Date.now() / 1000) + Number(normalized.expires_in);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

export async function signUp({ email, password, role, fullName }) {
  const data = await authRequest('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      data: { requested_role: role.toLowerCase(), full_name: fullName || '' },
    }),
  });
  return data?.access_token ? storeSession(data) : data;
}

export async function signIn(email, password) {
  const data = await authRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!data?.access_token) throw new Error('Supabase did not return an access token.');
  return storeSession(data);
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) return null;
  if (refreshInFlightPromise && refreshInFlightToken === refreshToken) return refreshInFlightPromise;

  const task = (async () => {
    try {
      const data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!data?.access_token) throw new Error('Session refresh did not return an access token.');
      return storeSession(data);
    } catch (error) {
      // Expired/revoked refresh tokens should be cleared; a transient network or 5xx
      // failure should not unnecessarily log the user out.
      if ([400, 401, 403].includes(error?.status)) storeSession(null);
      throw error;
    }
  })();

  refreshInFlightToken = refreshToken;
  refreshInFlightPromise = task;
  try {
    return await task;
  } finally {
    if (refreshInFlightPromise === task) {
      refreshInFlightPromise = null;
      refreshInFlightToken = null;
    }
  }
}

export async function getUser(accessToken) {
  if (!accessToken) throw new Error('No active Supabase session.');
  return authRequest('/auth/v1/user', { accessToken });
}

export async function signOut(accessToken) {
  try {
    if (accessToken) await authRequest('/auth/v1/logout', { method: 'POST', accessToken });
  } finally {
    storeSession(null);
  }
}

export function clearSession() { storeSession(null); }
export { SUPABASE_URL, SUPABASE_KEY };
