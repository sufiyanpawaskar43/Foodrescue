import { getStoredSession, refreshSession } from './auth.js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function backendConfigured() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }

function headers(accessToken, extra = {}) {
  const base = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
  // Only a real Supabase access token belongs in Authorization.
  // Sending the sb_publishable_* key as Bearer causes REST 401s.
  if (accessToken) base.Authorization = `Bearer ${accessToken}`;
  return base;
}

async function request(path, options = {}) {
  if (!backendConfigured()) throw new Error('FoodRescue Supabase environment variables are not configured.');
  let token = options.accessToken || null;
  let stored = getStoredSession();
  if (stored?.refresh_token) {
    // localStorage is the single-session source of truth. React state can still hold
    // a previous access token after a refresh; always replace that stale token first.
    if (stored.access_token && token !== stored.access_token) token = stored.access_token;
    const needsRefresh = !stored.access_token || (
      stored.expires_at && stored.expires_at * 1000 <= Date.now() + 30000
    );
    if (needsRefresh) {
      // Never silently downgrade an expired/corrupt signed-in request to anonymous access.
      stored = await refreshSession(stored.refresh_token);
      token = stored?.access_token || null;
      if (!token) throw new Error('Supabase session refresh did not return an access token. Please sign in again.');
    }
  }
  const { accessToken: _accessToken, headers: extraHeaders, ...fetchOptions } = options;
  const perform = (accessToken) => fetch(`${SUPABASE_URL}${path}`, {
    ...fetchOptions,
    headers: headers(accessToken, extraHeaders),
  });
  let response = await perform(token);
  if (response.status === 401 && token && stored?.refresh_token) {
    try {
      const latest = getStoredSession();
      // Another parallel request may already have rotated the token. Reuse that session
      // instead of spending the new refresh token again.
      if (latest?.access_token && latest.access_token !== token) {
        token = latest.access_token;
      } else {
        const renewed = await refreshSession(latest?.refresh_token || stored.refresh_token);
        token = renewed?.access_token || null;
      }
      if (token) response = await perform(token);
    } catch { /* Preserve the original REST error; the caller can sign in again. */ }
  }
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.msg || body?.hint || body?.details || body?.error_description || body?.error || text || `Supabase request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.code || body?.error_code;
    throw error;
  }
  return body;
}

const q = (value) => encodeURIComponent(String(value));
const selectOne = (rows) => Array.isArray(rows) ? rows[0] || null : rows;

export const api = {
  listFood: (_query = '', accessToken) => request('/rest/v1/rpc/list_available_food', { method: 'POST', accessToken, body: '{}' }),
  getFood: (id, accessToken) => request('/rest/v1/rpc/get_available_food_listing', {
    method: 'POST', accessToken, body: JSON.stringify({ p_listing_id: id }),
  }),
  listMyFood: (userId, accessToken) => request(`/rest/v1/food_listings?select=*&donor_id=eq.${q(userId)}&order=created_at.desc`, { accessToken }),
  listAllFood: (accessToken) => request('/rest/v1/food_listings?select=*&order=created_at.desc', { accessToken }),
  listClaims: (accessToken) => request('/rest/v1/rpc/list_foodrescue_claims', { method: 'POST', accessToken, body: '{}' }),
  listPickupRequests: (accessToken) => request('/rest/v1/pickup_requests?select=*&order=requested_at.desc', { accessToken }),
  // Use the scoped RPC: the table's participant RLS policy reads `claims`, whose direct SELECT grant is intentionally revoked.
  listVolunteerPickups: (accessToken) => request('/rest/v1/rpc/list_my_volunteer_pickups', { method: 'POST', accessToken, body: '{}' }),
  listOrganizations: (accessToken) => request('/rest/v1/organizations?select=*&order=created_at.desc', { accessToken }),
  listVerifiedOrganizations: (accessToken) => request('/rest/v1/rpc/list_verified_organizations_public', { method:'POST', accessToken, body:'{}' }),
  listOrganizationDocuments: (organizationId, accessToken) => request(`/rest/v1/organization_documents?select=*&organization_id=eq.${q(organizationId)}&order=created_at.desc`, { accessToken }),
  listAllOrganizationDocuments: (accessToken) => request('/rest/v1/organization_documents?select=*&order=created_at.desc', { accessToken }),
  createOrganizationDocumentSignedUrl: async (storagePath, accessToken) => {
    if (!storagePath || typeof storagePath !== 'string' || storagePath.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid verification document path.');
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    const response = await request(`/storage/v1/object/sign/foodrescue-documents/${encodedPath}`, { method:'POST', accessToken, body:JSON.stringify({ expiresIn:300 }) });
    const signed = response?.signedURL || response?.signedUrl;
    if (!signed) throw new Error('Supabase Storage did not return a temporary document URL.');
    return /^https?:\/\//i.test(signed) ? signed : `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`;
  },
  uploadFoodImage: async (userId, file, accessToken) => {
    if (!file) return null;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Food images must be JPEG, PNG or WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Food images must be 5 MB or smaller.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    await request(`/storage/v1/object/foodrescue-images/${encodeURIComponent(path).replace(/%2F/g,'/')}`, {
      method: 'POST', accessToken,
      headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
      body: file,
    });
    return `${SUPABASE_URL}/storage/v1/object/public/foodrescue-images/${path.split('/').map(encodeURIComponent).join('/')}`;
  },
  uploadOrganizationDocument: async (organizationId, userId, file, accessToken) => {
    if (!organizationId || !userId || !file) throw new Error('Choose a file after saving your organization profile.');
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) throw new Error('Verification documents must be a PDF, PNG or JPEG.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Verification documents must be 10 MB or smaller.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    await request(`/storage/v1/object/foodrescue-documents/${encodeURIComponent(path).replace(/%2F/g,'/')}`, {
      method: 'POST', accessToken,
      headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
      body: file,
    });
    try {
      return await request('/rest/v1/organization_documents', { method:'POST', accessToken, headers:{Prefer:'return=representation'}, body:JSON.stringify({organization_id:organizationId,storage_path:path,document_type:file.type,uploaded_by:userId}) });
    } catch (error) {
      // The private object is orphaned only if the metadata insert fails; surface the failure for admin repair.
      error.message = `Document file uploaded, but its metadata could not be saved: ${error.message}`;
      throw error;
    }
  },
  upsertVolunteerProfile: (payload, accessToken) => request('/rest/v1/rpc/upsert_my_volunteer_profile', { method:'POST', accessToken, body:JSON.stringify({p_service_area:payload.service_area || '', p_available:payload.available ?? true}) }),
  listSettings: (accessToken) => request('/rest/v1/platform_settings?select=*&order=key.asc', { accessToken }),
  saveSetting: (key, value, _userId, accessToken) => request('/rest/v1/rpc/admin_set_platform_setting', { method:'POST', accessToken, body:JSON.stringify({p_key:key,p_value:value}) }),
  adminExpireStaleFoodListings: (accessToken) => request('/rest/v1/rpc/admin_expire_stale_food_listings', { method:'POST', accessToken, body:'{}' }),
  upsertMyOrganization: (payload, accessToken) => request('/rest/v1/rpc/upsert_my_organization', {
    method:'POST', accessToken,
    body:JSON.stringify({
      p_name:payload.p_name ?? payload.name ?? '',
      p_organization_type:payload.p_organization_type ?? payload.organization_type ?? '',
      p_contact_person:payload.p_contact_person ?? payload.contact_person ?? '',
      p_phone:payload.p_phone ?? payload.phone ?? '',
      p_neighborhood:payload.p_neighborhood ?? payload.neighborhood ?? '',
      p_about:payload.p_about ?? payload.about ?? '',
    }),
  }),
  createOrganization: (payload, accessToken) => request('/rest/v1/rpc/upsert_my_organization', {
    method:'POST', accessToken,
    body:JSON.stringify({p_name:payload.name || '', p_organization_type:payload.organization_type || '', p_contact_person:payload.contact_person || '', p_phone:payload.phone || '', p_neighborhood:payload.neighborhood || '', p_about:payload.about || ''}),
  }),
  listReports: (accessToken) => request('/rest/v1/reports?select=*&order=created_at.desc', { accessToken }),
  listUsers: (accessToken) => request('/rest/v1/profiles?select=*&order=created_at.desc', { accessToken }),
  listAudit: (accessToken) => request('/rest/v1/audit_logs?select=*&order=created_at.desc', { accessToken }),
  listNotifications: (accessToken) => request('/rest/v1/notifications?select=*&order=created_at.desc', { accessToken }),
  getProfile: (userId, accessToken) => request(`/rest/v1/profiles?select=*&id=eq.${q(userId)}&limit=1`, { accessToken }).then(selectOne),
  ensureMyProfile: (requestedRole, accessToken) => request('/rest/v1/rpc/ensure_my_profile', { method: 'POST', accessToken, body: JSON.stringify({ p_requested_role: String(requestedRole || 'recipient').toLowerCase() }) }),
  getSaved: (accessToken) => request('/rest/v1/saved_food?select=listing_id', { accessToken }),
  claimFood: (listingId, accessToken) => request('/rest/v1/rpc/claim_food', { method: 'POST', accessToken, body: JSON.stringify({ p_listing_id: listingId }) }),
  toggleSaved: (listingId, accessToken) => request('/rest/v1/rpc/toggle_saved_food', { method: 'POST', accessToken, body: JSON.stringify({ p_listing_id: listingId }) }),
  createListing: (payload, accessToken) => request('/rest/v1/rpc/create_food_listing', { method: 'POST', accessToken, body: JSON.stringify(payload) }),
  updateListing: (payload, accessToken) => request('/rest/v1/rpc/update_food_listing', { method: 'POST', accessToken, body: JSON.stringify(payload) }),
  deleteListing: (listingId, accessToken) => request('/rest/v1/rpc/delete_food_listing', { method: 'POST', accessToken, body: JSON.stringify({ p_listing_id: listingId }) }),
  respondToClaim: (claimId, action, accessToken) => request('/rest/v1/rpc/respond_to_claim', { method: 'POST', accessToken, body: JSON.stringify({ p_claim_id: claimId, p_action: action }) }),
  offerPickup: (claimId, accessToken) => request('/rest/v1/rpc/offer_pickup', { method: 'POST', accessToken, body: JSON.stringify({ p_claim_id: claimId }) }),
  updateVolunteerPickup: (pickupId, status, accessToken) => request('/rest/v1/rpc/volunteer_update_pickup', { method: 'POST', accessToken, body: JSON.stringify({ p_pickup_id: pickupId, p_status: status }) }),
  verifyPickup: (code, token, accessToken) => request('/rest/v1/rpc/verify_pickup', { method: 'POST', accessToken, body: JSON.stringify({ p_code: code || null, p_token: token || null }) }),
  createReport: (payload, accessToken) => request('/rest/v1/rpc/create_report', { method: 'POST', accessToken, body: JSON.stringify(payload) }),
  markNotificationsRead: (ids = null, accessToken) => request('/rest/v1/rpc/mark_notifications_read', { method: 'POST', accessToken, body: JSON.stringify({ p_notification_ids: ids }) }),
  updateMyProfile: (payload, accessToken) => request('/rest/v1/rpc/update_my_profile', { method: 'POST', accessToken, body: JSON.stringify(payload) }),
  adminReviewOrganization: (id, status, note, accessToken) => request('/rest/v1/rpc/admin_review_organization', { method: 'POST', accessToken, body: JSON.stringify({ p_organization_id: id, p_status: status, p_note: note || null }) }),
  adminReviewListing: (id, action, note, accessToken) => request('/rest/v1/rpc/admin_review_listing', { method: 'POST', accessToken, body: JSON.stringify({ p_listing_id: id, p_action: action, p_note: note || null }) }),
  adminReviewReport: (id, status, note, accessToken) => request('/rest/v1/rpc/admin_review_report', { method: 'POST', accessToken, body: JSON.stringify({ p_report_id: id, p_status: status, p_note: note || null }) }),
  adminSetUserStatusWithNote: (id, status, note, accessToken) => request('/rest/v1/rpc/admin_set_user_status_with_note', { method: 'POST', accessToken, body: JSON.stringify({ p_user_id: id, p_status: status, p_note: note || null }) }),
  adminSetUserRoleWithNote: (id, role, note, accessToken) => request('/rest/v1/rpc/admin_set_user_role_with_note', { method: 'POST', accessToken, body: JSON.stringify({ p_user_id: id, p_role: role.toLowerCase(), p_note: note || null }) }),
};
