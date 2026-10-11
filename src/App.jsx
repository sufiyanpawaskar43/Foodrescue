import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import { routeByPage, pathToPage, roles, photo, navForRole } from './appData.js';
import { signUp as authSignUp, signIn as authSignIn, refreshSession, getUser, signOut as authSignOut, getStoredSession, clearSession } from './services/auth.js';
import { api } from './services/backend.js';

function App() {

  const location = useLocation();
  const routerNavigate = useNavigate();
  const [page, setPage] = useState(pathToPage(location.pathname));
  const [role, setRole] = useState('Recipient');
  const [foods, setFoods] = useState([]);
  const [claims, setClaims] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All food');
  const [showFoodFilters, setShowFoodFilters] = useState(false);
  const [maxDistance, setMaxDistance] = useState('any');
  const [pickupCutoff, setPickupCutoff] = useState('any');
  const [hideClaimed, setHideClaimed] = useState(false);
  const [sortNearby, setSortNearby] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedAdminRecord, setSelectedAdminRecord] = useState(null);
  const [adminOutcomes, setAdminOutcomes] = useState({});
  const [mobileNav, setMobileNav] = useState(false);
  const [form, setForm] = useState({ title: '', description:'', qty: '', unit:'Portions', category: 'Meals', area: '', availableFrom:'', pickup: '', allergens:'', storageNotes:'', image: '', imageFile: null });
  const [session, setSession] = useState(() => getStoredSession());
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authRestoreFailed, setAuthRestoreFailed] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendErrors, setBackendErrors] = useState([]);
  const [backendNotifications, setBackendNotifications] = useState([]);
  const [backendOrganizationDocuments, setBackendOrganizationDocuments] = useState([]);
  const [backendAllOrganizationDocuments, setBackendAllOrganizationDocuments] = useState([]);
  const [backendPublicOrganizations, setBackendPublicOrganizations] = useState([]);
  const [backendVolunteerPickups, setBackendVolunteerPickups] = useState([]);
  const [backendMyFood, setBackendMyFood] = useState([]);
  const [backendModerationFood, setBackendModerationFood] = useState([]);
  const [backendOrganizations, setBackendOrganizations] = useState([]);
  const [backendReports, setBackendReports] = useState([]);
  const [backendUsers, setBackendUsers] = useState([]);
  const [backendAudit, setBackendAudit] = useState([]);
  const [backendSettings, setBackendSettings] = useState([]);
  // Supersede older data loads so requests from a previous account cannot repopulate state after logout.
  const backendLoadVersion = useRef(0);

  const clearAuthError = () => setAuthError('');
  const retrySessionRestore = () => { setAuthError(''); window.location.reload(); };
  const dashboardForRole = (r) => r === 'Admin' ? 'Admin dashboard' : r === 'Donor' ? 'Donor dashboard' : r === 'Volunteer' ? 'Volunteer dashboard' : 'Recipient dashboard';
  const applyAuthenticatedUser = async (nextSession, { fallbackRole = null } = {}) => {
    if (!nextSession?.access_token) return null;
    const authUser = await getUser(nextSession.access_token);
    if (!authUser?.id) throw new Error('Supabase returned an invalid user session. Please sign in again.');
    let nextProfile = await api.getProfile(authUser.id, nextSession.access_token);

    // Repair legacy Auth users whose public profile row is missing. The RPC only
    // accepts Recipient/Donor/Volunteer and never creates or assigns an Admin.
    if (!nextProfile && fallbackRole && fallbackRole !== 'Admin') {
      const ensuredProfile = await api.ensureMyProfile(fallbackRole, nextSession.access_token);
      nextProfile = Array.isArray(ensuredProfile) ? ensuredProfile[0] || null : ensuredProfile;
      if (!nextProfile?.id) nextProfile = await api.getProfile(authUser.id, nextSession.access_token);
    }
    if (!nextProfile || nextProfile.id !== authUser.id) {
      const error = new Error(fallbackRole === 'Admin'
        ? 'This account is not configured as an administrator. Admin accounts must be provisioned by the platform owner.'
        : 'This account profile could not be initialized. Please try again or contact platform support.');
      error.status = 403;
      throw error;
    }
    if (nextProfile.status !== 'active') {
      const error = new Error('This FoodRescue account is suspended. Contact platform support if you believe this is a mistake.');
      error.status = 403;
      throw error;
    }
    const dbRole = String(nextProfile.role || '').toLowerCase();
    const roleMap = { admin: 'Admin', donor: 'Donor', volunteer: 'Volunteer', recipient: 'Recipient' };
    const uiRole = roleMap[dbRole];
    if (!uiRole) {
      const error = new Error('Your FoodRescue account has an unsupported role. Contact platform support.');
      error.status = 403;
      throw error;
    }
    setSession(nextSession); setUser(authUser); setProfile(nextProfile); setRole(uiRole);
    return { authUser, nextProfile, uiRole };
  };
  const signIn = async (email,password,selectedRole='Recipient') => {
    setAuthLoading(true); setAuthError(''); setAuthRestoreFailed(false);
    try {
      const nextSession = await authSignIn(email,password);
      const result = await applyAuthenticatedUser(nextSession, { fallbackRole: selectedRole });
      if (!result) throw new Error('Supabase did not return an authenticated session.');
      if (selectedRole !== result.uiRole) {
        setAuthError(`This account is registered as ${result.uiRole}. Select ${result.uiRole} and sign in again.`);
        await authSignOut(nextSession.access_token);
        setSession(null); setUser(null); setProfile(null);
        return;
      }
      navigate(dashboardForRole(result.uiRole));
      await loadBackendData(nextSession.access_token, result.authUser.id, result.uiRole);
    } catch (error) {
      clearSession(); setSession(null); setUser(null); setProfile(null); setRole('Recipient');
      setAuthError(error?.message || 'Unable to sign in. Please check your email and password.');
    } finally { setAuthLoading(false); }
  };
  const signUp = async (email,password,selectedRole='Recipient') => {
    setAuthLoading(true); setAuthError(''); setAuthRestoreFailed(false);
    try {
      const data = await authSignUp({email,password,role:selectedRole,fullName:''});
      if (!data?.access_token) {
        setAuthError('Instant sign-up is still blocked by Supabase Email Confirmations. In your Supabase Dashboard, open Authentication → Sign In / Providers → Email and turn OFF “Confirm email”, then try creating the account again. No email confirmation can be bypassed from frontend code while the project setting remains enabled.');
        return;
      }
      const result = await applyAuthenticatedUser(data, { fallbackRole: selectedRole });
      if (!result) throw new Error('Supabase did not return an authenticated session.');
      setAuthReady(true);
      await loadBackendData(data.access_token, result.authUser.id, result.uiRole);
      navigate('Onboarding');
    } catch (error) {
      setAuthError(error?.message || 'Unable to create the account.');
    } finally { setAuthLoading(false); }
  };
  const respondToClaim = async (claimId, action) => {
    if (!session?.access_token) return navigate('Sign in');
    if (role !== 'Donor') return flash('Only donor accounts can approve or decline food claims.');
    try {
      const updated = await api.respondToClaim(claimId, action, session.access_token);
      const statusLabel = ({pending:'Pending approval',approved:'Approved',rejected:'Rejected',picked_up:'Picked up',cancelled:'Cancelled'})[updated.status] || updated.status;
      setClaims(current=>current.map(c=>(c.claimId===claimId||c.id===claimId)?{...c,...updated,id:updated.listing_id,listing_id:updated.listing_id,claimId:updated.id,pickupToken:updated.pickup_token,pickupCode:updated.pickup_code,pickupStatus:statusLabel}:c));
      setApprovedRequests(current=>action==='approve'?[...new Set([...current,claimId])]:current.filter(id=>id!==claimId));
      await loadBackendData(session.access_token, user?.id, role);
      flash(action==='approve'?'Claim approved.':'Claim declined.');
      return updated;
    } catch (error) { flash(error?.message || 'Could not update the claim.'); return null; }
  };
  const offerPickup = async (claimId) => {
    if (!session?.access_token) return navigate('Sign in');
    if (role !== 'Volunteer') return flash('Only volunteer accounts can accept pickup assistance.');
    try { const pickup=await api.offerPickup(claimId,session.access_token); await loadBackendData(session.access_token,user?.id,role); flash('Pickup accepted.'); return pickup; }
    catch(error){ flash(error?.message || 'Could not offer pickup help.'); return null; }
  };
  const updateVolunteerPickup = async (pickupId,status) => {
    if (!session?.access_token) return navigate('Sign in');
    if (role !== 'Volunteer') { flash('Only volunteer accounts can update pickup progress.'); return null; }
    try { const pickup=await api.updateVolunteerPickup(pickupId,status,session.access_token); await loadBackendData(session.access_token,user?.id,role); flash(`Pickup marked ${status.replace('_',' ')}.`); return pickup; }
    catch(error){ flash(error?.message || 'Could not update pickup.'); return null; }
  };
  const apiMarkNotificationsRead = async () => {
    if (!session?.access_token) return false;
    try { await api.markNotificationsRead(null,session.access_token); setBackendNotifications(current=>current.map(n=>({...n,read_at:n.read_at||new Date().toISOString()}))); return true; }
    catch(error){ flash(error?.message || 'Could not mark notifications as read.'); return false; }
  };
  const verifyPickup = async (value, kind) => {
    if (!session?.access_token) return {ok:false,message:'Please sign in first.'};
    if (!['Donor','Volunteer'].includes(role)) return {ok:false,message:'Only donors or volunteers can verify a pickup.'};
    try {
      const claim=await api.verifyPickup(kind==='code'?value:null,kind==='qr'?value:null,session.access_token);
      const statusLabel = ({pending:'Pending approval',approved:'Approved',rejected:'Rejected',picked_up:'Picked up',cancelled:'Cancelled'})[claim.status] || claim.status;
      setClaims(current=>current.map(c=>(c.claimId===claim.id||c.id===claim.listing_id)?{...c,...claim,id:claim.listing_id,listing_id:claim.listing_id,claimId:claim.id,pickupToken:claim.pickup_token,pickupCode:claim.pickup_code,pickupStatus:statusLabel}:c));
      await loadBackendData(session.access_token,user?.id,role);
      flash('Pickup verified successfully.');
      return {ok:true,message:'Pickup verified successfully.'};
    } catch(error){ return {ok:false,message:error?.message || 'Pickup verification failed.'}; }
  };
  const logout = async () => {
    backendLoadVersion.current += 1;
    setAuthLoading(true);
    try { if (session?.access_token) await authSignOut(session.access_token); }
    catch { /* The local session must still be cleared if the logout endpoint is unreachable. */ }
    finally {
      setSession(null); setUser(null); setProfile(null); setRole('Recipient'); setAuthRestoreFailed(false); setClaims([]); setSavedIds([]); setApprovedRequests([]); setFoods([]);
      setBackendErrors([]); setBackendOrganizationDocuments([]); setBackendAllOrganizationDocuments([]); setBackendNotifications([]); setBackendVolunteerPickups([]);
      setBackendMyFood([]); setBackendOrganizations([]); setBackendReports([]); setBackendUsers([]); setBackendAudit([]);
      setBackendSettings([]); setBackendModerationFood([]); setAuthLoading(false); setAuthReady(true); navigate('Overview');
    }
  };
  const updateProfile = async (payload) => {
    if (!session?.access_token || !user?.id) {
      setAuthError('Your session has expired. Please sign in again.');
      navigate('Sign in');
      return false;
    }
    const storedRole = String(profile?.role || '').toLowerCase();
    if (payload.role && String(payload.role).toLowerCase() !== storedRole) {
      const message = 'Your role is fixed to the role assigned to this account. Create a separate account to use another role.';
      setAuthError(message);
      throw new Error(message);
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const saved = await api.updateMyProfile({
        p_full_name: payload.fullName ?? profile?.full_name ?? '',
        p_phone: payload.phone ?? profile?.phone ?? '',
        p_neighborhood: payload.neighborhood ?? profile?.neighborhood ?? '',
        p_avatar_url: null,
      }, session.access_token);
      setProfile(saved);

      if (role === 'Volunteer') {
        await api.upsertVolunteerProfile({ service_area: payload.neighborhood ?? saved.neighborhood ?? '', available: true }, session.access_token);
      } else if (role === 'Donor' || role === 'Recipient') {
        const currentOrg = (backendOrganizations || []).find(org => org.owner_id === user.id);
        await api.upsertMyOrganization({
          p_name: payload.organizationName ?? currentOrg?.name ?? payload.fullName ?? saved.full_name ?? '',
          p_organization_type: payload.organizationType ?? currentOrg?.organization_type ?? (role === 'Donor' ? 'Business' : 'Community organization'),
          p_contact_person: payload.contactPerson ?? payload.fullName ?? saved.full_name ?? '',
          p_phone: payload.phone ?? saved.phone ?? '',
          p_neighborhood: payload.neighborhood ?? saved.neighborhood ?? '',
          p_about: payload.about ?? currentOrg?.about ?? '',
        }, session.access_token);
      }

      await loadBackendData(session.access_token, user.id, role);
      flash('Profile saved.');
      return true;
    } catch (error) {
      setAuthError(error?.message || 'Could not save your profile.');
      throw error;
    } finally { setAuthLoading(false); }
  };
  const mapFood = (f, organizationRows = backendOrganizations) => {
    return {
      ...f,
      id: f.id,
      title: f.title,
      donor: f.donor?.full_name || f.donor_name || organizationRows?.find(org => org.owner_id === f.donor_id)?.name || (f.donor_id && f.donor_id === user?.id ? 'Your organization' : 'Community donor'),
      category: f.category,
      qty: `${f.quantity} ${f.unit || 'portions'}`,
      distance: f.distance || 'Distance unavailable',
      area: f.pickup_area,
      time: f.pickup_deadline ? `Pickup by ${new Date(f.pickup_deadline).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : 'Pickup time listed',
      badge: f.status === 'available' ? 'Available' : f.status,
      image: f.image_url || photo('photo-1512621776951-a57141f2eefd'),
      price: 0,
      emoji: '🥗',
      status: f.status,
      raw: f
    };
  };
  const loadBackendData = async (accessToken=session?.access_token, userId=user?.id, uiRole=role) => {
    const loadVersion = ++backendLoadVersion.current;
    const isLatestLoad = () => backendLoadVersion.current === loadVersion;
    setBackendLoading(true);
    const issues = [];
    const safe = async (label, promise, fallback = []) => {
      try { return await promise; }
      catch (error) {
        issues.push({ label, message: error?.message || 'Request failed', status: error?.status || null });
        return fallback;
      }
    };
    try {
      if (accessToken && userId && uiRole === 'Admin') {
        await safe('Expire stale listings', api.adminExpireStaleFoodListings(accessToken), 0);
        if (!isLatestLoad()) return;
      }

      const [feedRows, publicOrganizations] = await Promise.all([
        safe('Available food feed', api.listFood('', accessToken), []),
        safe('Verified organization catalog', api.listVerifiedOrganizations(accessToken), []),
      ]);
      if (!isLatestLoad()) return;
      setFoods((feedRows || []).map(mapFood));
      setBackendPublicOrganizations(publicOrganizations || []);

      if (!accessToken || !userId) {
        setClaims([]); setSavedIds([]); setApprovedRequests([]); setBackendOrganizationDocuments([]); setBackendAllOrganizationDocuments([]);
        setBackendNotifications([]); setBackendVolunteerPickups([]); setBackendMyFood([]);
        setBackendOrganizations([]); setBackendReports([]); setBackendUsers([]); setBackendAudit([]);
        setBackendSettings([]); setBackendModerationFood([]); setBackendErrors(issues);
        return;
      }

      const [saved, organizations, claimRows, pickupRows, notifications, volunteerRows] = await Promise.all([
        safe('Saved food', api.getSaved(accessToken)),
        safe('Organizations', api.listOrganizations(accessToken)),
        safe('Claims', api.listClaims(accessToken)),
        safe('Pickup requests', api.listPickupRequests(accessToken)),
        safe('Notifications', api.listNotifications(accessToken)),
        safe('Volunteer pickups', api.listVolunteerPickups(accessToken)),
      ]);
      if (!isLatestLoad()) return;

      setSavedIds((saved || []).map(item => item.listing_id));
      setBackendOrganizations(organizations || []);
      setClaims((claimRows || []).map(claim => ({
        ...claim,
        id: claim.listing_id,
        listing_id: claim.listing_id,
        claimId: claim.id,
        pickupToken: claim.pickup_token,
        pickupCode: claim.pickup_code,
        pickupStatus: ({ pending:'Pending approval', approved:'Approved', rejected:'Rejected', picked_up:'Picked up', cancelled:'Cancelled' })[claim.status] || claim.status,
        title: claim.title || 'Claimed food',
        donor: claim.donor_name || 'Community donor',
        qty: claim.quantity ? `${claim.quantity} ${claim.unit || 'portions'}` : '',
        area: claim.pickup_area || '',
        time: claim.pickup_deadline ? `Pickup by ${new Date(claim.pickup_deadline).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}` : 'Pickup time not listed',
        image: claim.image_url || photo('photo-1512621776951-a57141f2eefd'),
      })));
      setApprovedRequests((pickupRows || []).filter(item => item.status === 'accepted').map(item => item.claim_id));
      setBackendNotifications(notifications || []);
      setBackendVolunteerPickups(volunteerRows || []);

      const ownedOrg = (organizations || []).find(item => item.owner_id === userId);
      const documents = ownedOrg
        ? await safe('Verification documents', api.listOrganizationDocuments(ownedOrg.id, accessToken), [])
        : [];
      if (!isLatestLoad()) return;
      setBackendOrganizationDocuments(documents || []);

      if (uiRole === 'Donor') {
        const donorRows = await safe('Your food listings', api.listMyFood(userId, accessToken), []);
        if (!isLatestLoad()) return;
        setBackendMyFood((donorRows || []).map(row=>mapFood(row, organizations || [])));
      } else setBackendMyFood([]);

      if (uiRole === 'Admin') {
        const [reports, members, audit, settings, allFood, allDocuments] = await Promise.all([
          safe('Reports', api.listReports(accessToken)),
          safe('Member directory', api.listUsers(accessToken)),
          safe('Audit log', api.listAudit(accessToken)),
          safe('Platform settings', api.listSettings(accessToken)),
          safe('All food listings', api.listAllFood(accessToken)),
          safe('Organization documents', api.listAllOrganizationDocuments(accessToken)),
        ]);
        if (!isLatestLoad()) return;
        setBackendReports(reports || []); setBackendUsers(members || []); setBackendAudit(audit || []);
        setBackendSettings(settings || []); setBackendModerationFood((allFood || []).map(row=>mapFood(row, organizations || [])));
        setBackendAllOrganizationDocuments(allDocuments || []);
      } else {
        setBackendReports([]); setBackendUsers([]); setBackendAudit([]); setBackendSettings([]); setBackendModerationFood([]); setBackendAllOrganizationDocuments([]);
      }
      setBackendErrors(issues);
    } finally {
      if (isLatestLoad()) setBackendLoading(false);
    }
  };
  const flash = (message) => { setToast(message); window.clearTimeout(window._foodToast); window._foodToast = window.setTimeout(() => setToast(''), 2800); };
  const selectRole = (nextRole) => {
    if (session?.access_token) {
      if (nextRole !== role) flash('Your role is fixed to the role assigned to your signed-in FoodRescue account.');
      return role;
    }
    if (!['Recipient', 'Donor', 'Volunteer', 'Admin'].includes(nextRole)) return role;
    setRole(nextRole);
    return nextRole;
  };
  const navigate = (next) => { setPage(next); routerNavigate(routeByPage[next] || '/'); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openDonationDetails = (food) => {
    if (!food?.id) return flash('That listing could not be opened.');
    setSelected(food); setPage('Donation details'); routerNavigate(`/donor/listings/${encodeURIComponent(food.id)}`); setMobileNav(false); window.scrollTo({top:0,behavior:'smooth'});
  };
  const openPickupPass = (claim) => {
    if (!claim?.claimId || claim.status !== 'approved') return flash('A pickup pass is available only after the donor approves the claim.');
    setSelected(claim); setPage('Pickup pass'); routerNavigate(`/pickup/pass/${encodeURIComponent(claim.claimId)}`); setMobileNav(false); window.scrollTo({top:0,behavior:'smooth'});
  };
  const openPickupDetails = (pickupOrClaim) => {
    const claimId = pickupOrClaim?.claim_id || pickupOrClaim?.claimId || pickupOrClaim?.id;
    if (!claimId) return flash('That pickup could not be opened.');
    setSelected(pickupOrClaim); setPage('Pickup details'); routerNavigate(`/volunteer/pickups/${encodeURIComponent(claimId)}`); setMobileNav(false); window.scrollTo({top:0,behavior:'smooth'});
  };
  const updateFoodListing = async (listingId, payload) => {
    if (!session?.access_token || role !== 'Donor') { flash('Sign in with a donor account to edit listings.'); return false; }
    try {
      const deadline = new Date(payload.pickupDeadline);
      if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) throw new Error('Choose a pickup deadline in the future.');
      await api.updateListing({
        p_listing_id: listingId,
        p_title: payload.title,
        p_description: payload.description || '',
        p_category: payload.category,
        p_quantity: Number(payload.quantity),
        p_unit: payload.unit || 'Portions',
        p_pickup_deadline: deadline.toISOString(),
        p_allergens: payload.allergens || '',
        p_storage_notes: payload.storageNotes || '',
        p_pickup_area: payload.pickupArea || '',
        p_image_url: payload.imageUrl || null,
      }, session.access_token);
      await loadBackendData(session.access_token, user?.id, role);
      flash('Listing updated.');
      return true;
    } catch(error) { flash(error?.message || 'Could not update the listing.'); return false; }
  };
  const deleteFoodListing = async (listingId) => {
    if (!session?.access_token || role !== 'Donor') { flash('Sign in with a donor account to remove listings.'); return false; }
    try {
      const removed = await api.deleteListing(listingId, session.access_token);
      if (!removed) throw new Error('This listing cannot be removed while it has an active pickup or is no longer editable.');
      await loadBackendData(session.access_token, user?.id, role);
      setSelected(null); navigate('My listings'); flash('Listing removed.');
      return true;
    } catch(error) { flash(error?.message || 'Could not remove the listing.'); return false; }
  };
  React.useEffect(() => {
    let active = true;
    (async () => {
      const stored = getStoredSession();
      if (!stored?.access_token) {
        if (active) setAuthReady(true);
        await loadBackendData(null, null, 'Recipient');
        return;
      }
      try {
        let current = stored;
        if (current.expires_at && current.expires_at * 1000 <= Date.now() + 30000 && current.refresh_token) {
          current = await refreshSession(current.refresh_token);
        }
        const result = await applyAuthenticatedUser(current);
        if (!result) throw new Error('Could not restore the FoodRescue session. Please sign in again.');
        if (active) await loadBackendData(current.access_token, result.authUser.id, result.uiRole);
      } catch (error) {
        // Only discard credentials when Supabase definitively rejects the session.
        // A timeout, offline request, or 5xx should not erase a valid refresh token.
        const definitiveSessionFailure = [400, 401, 403].includes(error?.status);
        if (definitiveSessionFailure) clearSession();
        if (active) {
          setSession(null); setUser(null); setProfile(null); setRole('Recipient');
          setAuthRestoreFailed(!definitiveSessionFailure);
          if (definitiveSessionFailure) setAuthError(error?.message || 'Your saved session is no longer valid. Please sign in again.');
          else setAuthError(`Could not restore your saved session: ${error?.message || 'network unavailable'}. Retry when your connection is available.`);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);
  React.useEffect(() => {
    const match = location.pathname.match(/^\/food\/([0-9a-f-]{36})$/i);
    if (!match) return;
    const id = match[1];
    const existing = foods.find(item => String(item.id) === id);
    if (existing) { setSelected(existing); return; }
    let active = true;
    api.getFood(id, session?.access_token).then(rows => {
      if (!active) return;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row) {
        const mapped = mapFood(row);
        setSelected(mapped);
        setFoods(current => current.some(item => item.id === mapped.id) ? current : [mapped, ...current]);
      } else setSelected(null);
    }).catch(() => { if (active) setSelected(null); });
    return () => { active = false; };
  }, [location.pathname, foods, session?.access_token]);
  React.useEffect(() => {
    if (!authReady) return;
    const path = location.pathname;
    const protectedPrefixes = ['/recipient','/donor','/volunteer','/pickup','/profile','/notifications','/report','/admin'];
    const protectedPath = protectedPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
    if (!session?.access_token && protectedPath && path !== '/admin/login') {
      navigate(path.startsWith('/admin') ? 'Admin sign in' : 'Sign in');
      return;
    }
    if (!session?.access_token) return;
    if (['/login', '/signup', '/admin/login'].includes(path)) {
      navigate(dashboardForRole(role));
      return;
    }

    let requiredRole = null;
    if ((path.startsWith('/admin/') && path !== '/admin/login') || path === '/admin') requiredRole = 'Admin';
    else if (path === '/donor' || path.startsWith('/donor/')) requiredRole = 'Donor';
    else if (path === '/volunteer' || path.startsWith('/volunteer/')) requiredRole = 'Volunteer';
    else if (path === '/recipient' || path.startsWith('/recipient/')) requiredRole = 'Recipient';
    else if (path === '/pickup/pass' || path.startsWith('/pickup/pass/')) requiredRole = 'Recipient';
    else if (path === '/pickup/verify' && !['Donor','Volunteer'].includes(role)) {
      navigate(dashboardForRole(role));
      return;
    }
    if (requiredRole && requiredRole !== role) navigate(dashboardForRole(role));
  }, [authReady, location.pathname, session?.access_token, role]);
  React.useEffect(() => {
    setPage(pathToPage(location.pathname));
    // The URL may select a preview role only while signed out. Once authenticated,
    // the role from public.profiles is authoritative and cannot be changed by navigation.
    if (!session?.access_token) {
      if (location.pathname.startsWith('/admin')) setRole('Admin');
      else if (location.pathname.startsWith('/donor')) setRole('Donor');
      else if (location.pathname.startsWith('/volunteer')) setRole('Volunteer');
      else if (location.pathname.startsWith('/recipient') || location.pathname.startsWith('/map') || location.pathname.startsWith('/browse')) setRole('Recipient');
    }
  }, [location.pathname, session?.access_token]);
  React.useEffect(() => { const go = () => navigate('Overview'); window.addEventListener('home', go); return () => window.removeEventListener('home', go); }, []);
  const filtered = useMemo(() => {
    const minutes = (value) => { const match=String(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!match)return 0;let hour=Number(match[1])%12;if(match[3].toUpperCase()==='PM')hour+=12;return hour*60+Number(match[2]); };
    const list=foods.filter(f => (category === 'All food' || f.category === category) && `${f.title} ${f.donor} ${f.area}`.toLowerCase().includes(query.toLowerCase()) && (maxDistance==='any'||Number.parseFloat(f.distance)<=Number(maxDistance)) && (pickupCutoff==='any'||minutes(f.time)<=Number(pickupCutoff)) && (!hideClaimed||!claims.some(c=>c.id===f.id)));
    return sortNearby?list.sort((a,b)=>Number.parseFloat(a.distance)-Number.parseFloat(b.distance)):list;
  }, [foods, category, query, maxDistance, pickupCutoff, hideClaimed, sortNearby, claims]);
  const clearFoodFilters = () => { setCategory('All food');setQuery('');setMaxDistance('any');setPickupCutoff('any');setHideClaimed(false);setSortNearby(false); };
  const claimFood = async (food) => {
    if (!session?.access_token) return navigate('Sign in');
    if (role !== 'Recipient') return flash('Only recipient accounts can claim food.');
    if (claims.some(c => c.id === food.id || c.listing_id === food.id)) return flash('You’ve already claimed this listing.');
    try {
      const claim = await api.claimFood(food.id, session.access_token);
      setClaims(current => [{...food,...claim,id:food.id,listing_id:food.id,claimId:claim.id,pickupToken:claim.pickup_token,pickupCode:claim.pickup_code,pickupStatus:'Pending approval',status:claim.status}, ...current.filter(c=>c.id!==food.id)]);
      setFoods(current=>current.filter(f=>f.id!==food.id));
      setSelected(null); setModal(''); await loadBackendData(session.access_token,user?.id,role); flash('Claim request sent. The donor will confirm pickup.'); navigate('My claims');
    } catch (error) { flash(error?.message || 'Could not claim this listing.'); }
  };
  const toggleSaved = async (food) => {
    if (!session?.access_token) return navigate('Sign in');
    if (role !== 'Recipient') return flash('Only recipient accounts can save food.');
    try {
      const saved = await api.toggleSaved(food.id, session.access_token);
      setSavedIds(current => saved ? [...new Set([...current,food.id])] : current.filter(id=>id!==food.id));
      flash(saved ? 'Saved to your food list.' : 'Removed from saved food.');
    } catch (error) { flash(error?.message || 'Could not update saved food.'); }
  };
  const openFood = (food) => { setSelected(food); setPage('Food details'); routerNavigate(`/food/${food.id}`); window.scrollTo({top:0,behavior:'smooth'}); };
  const openAdminRecord = (kind,row) => { setSelectedAdminRecord(row); const pageFor={organization:'Organization review',listing:'Listing review',report:'Report review',user:'User detail',audit:'Audit detail'}[kind];const prefix={organization:'organizations',listing:'listings',report:'reports',user:'users',audit:'audit'}[kind];const recordId=String(row?.[5]||'');const slug=encodeURIComponent(recordId || String(row?.[0]||'record').toLowerCase().replace(/[^a-z0-9]+/g,'-'));setPage(pageFor);routerNavigate(`/admin/${prefix}/${slug}${kind==='listing'?'/review':''}`);window.scrollTo({top:0,behavior:'smooth'}); };
  const recordAction = async (kind, action, record, memberRole, note = '') => {
    if (!session?.access_token) { navigate('Admin sign in'); return false; }
    if (role !== 'Admin') { flash('Only an authenticated admin can moderate platform records.'); return false; }
    const id = record?.[5];
    if (!id) { flash('The record ID is missing. Refresh the list and reopen the record.'); return false; }
    try {
      if (kind === 'organization') {
        const status = action === 'Approve organization' ? 'verified' : action === 'Decline request' ? 'rejected' : action === 'Request more information' ? 'pending' : null;
        if (!status) throw new Error('Unsupported organization review action.');
        await api.adminReviewOrganization(id, status, note, session.access_token);
      } else if (kind === 'listing') {
        const reviewAction = action === 'Approve listing' ? 'approve' : action === 'Hide listing' ? 'hide' : action === 'Request an edit' ? 'request_edit' : null;
        if (!reviewAction) throw new Error('Unsupported listing review action.');
        await api.adminReviewListing(id, reviewAction, note, session.access_token);
      } else if (kind === 'report') {
        const status = action === 'Mark resolved' ? 'resolved' : action === 'Dismiss report' ? 'dismissed' : action === 'Escalate for review' ? 'escalated' : null;
        if (!status) throw new Error('Unsupported report review action.');
        await api.adminReviewReport(id, status, note, session.access_token);
      } else if (kind === 'user') {
        if (action === 'Suspend account') await api.adminSetUserStatusWithNote(id, 'suspended', note, session.access_token);
        else if (action === 'Restore account') await api.adminSetUserStatusWithNote(id, 'active', note, session.access_token);
        else if ((action === 'Save member changes' || action === 'Change role') && memberRole) await api.adminSetUserRoleWithNote(id, memberRole, note, session.access_token);
        else throw new Error('Unsupported member review action.');
      } else {
        throw new Error('This record is read-only.');
      }
      await loadBackendData(session.access_token, user?.id, 'Admin');
      // Force detail views to resolve the just-refreshed record instead of retaining stale row data.
      setSelectedAdminRecord(null);
      flash(`${action} saved.`);
      return true;
    } catch (error) { flash(error?.message || 'Could not save the admin action.'); return false; }
  };
  const getOrganizationDocumentViewUrl = async (storagePath) => {
    if (!session?.access_token || !user?.id) throw new Error('Sign in to view verification documents.');
    const ownsDocument = (backendOrganizationDocuments || []).some(doc => doc.storage_path === storagePath && doc.uploaded_by === user.id);
    if (role !== 'Admin' && !ownsDocument) throw new Error('You are not allowed to view this verification document.');
    try { return await api.createOrganizationDocumentSignedUrl(storagePath, session.access_token); }
    catch (error) { flash(error?.message || 'Could not create a secure document link.'); throw error; }
  };

  const uploadOrganizationDocument = async (file) => {
    if (!session?.access_token || !user?.id) { navigate('Sign in'); return false; }
    const organization = (backendOrganizations || []).find(o => o.owner_id === user.id);
    if (!organization) { flash('Save your own organization profile before uploading verification documents.'); return false; }
    try {
      await api.uploadOrganizationDocument(organization.id,user.id,file,session.access_token);
      const docs = await api.listOrganizationDocuments(organization.id,session.access_token).catch(()=>backendOrganizationDocuments);
      setBackendOrganizationDocuments(docs || []);
      flash('Verification document uploaded.');
      return true;
    }
    catch(error){ flash(error?.message || 'Could not upload the document.'); return false; }
  };
  const savePlatformSetting = async (key, value) => {
    if (!session?.access_token || role !== 'Admin') { flash('Only an authenticated admin can change platform settings.'); return false; }
    try {
      const saved = await api.saveSetting(key,value,user?.id,session.access_token);
      const row = Array.isArray(saved) ? saved[0] : saved;
      setBackendSettings(current=>[...current.filter(item=>item.key!==key),row || {key,value}]);
      flash('Platform setting saved.');
      return true;
    } catch(error){ flash(error?.message || 'Could not save platform setting.'); return false; }
  };
  const submitReport = async ({listingId, organizationId, reason, description}) => {
    if (!session?.access_token) return navigate('Sign in');
    try { await api.createReport({p_listing_id:listingId || null,p_organization_id:organizationId || null,p_reason:reason,p_description:description},session.access_token); flash('Report submitted successfully.'); return true; }
    catch(error){ flash(error?.message || 'Could not submit report.'); return false; }
  };
  const addListing = async (e) => {
    e.preventDefault();
    if (!session?.access_token) return navigate('Sign in');
    if (!form.title || !form.qty || !form.area || !form.pickup) return flash('Add title, quantity, pickup area and pickup deadline.');
    try {
      const deadline = new Date(form.pickup);
      if (Number.isNaN(deadline.getTime())) throw new Error('Use a valid pickup deadline such as 2026-10-08 20:30.');
      const imageUrl = form.imageFile ? await api.uploadFoodImage(user.id, form.imageFile, session.access_token) : (form.image && /^https?:\/\//i.test(form.image) ? form.image : null);
      const created = await api.createListing({
        p_title:form.title.trim(),p_description:form.description || '',p_category:form.category,p_quantity:Number(form.qty),p_unit:form.unit || 'Portions',
        p_available_from:form.availableFrom ? new Date(form.availableFrom).toISOString() : new Date().toISOString(),p_pickup_deadline:deadline.toISOString(),p_allergens:form.allergens || '',
        p_storage_notes:form.storageNotes || '',p_pickup_area:form.area.trim(),p_image_url:imageUrl
      }, session.access_token);
      // Refresh the donor listing collection after a successful insert. Updating only the
      // public food feed left the My Listings page empty until the next manual reload.
      await loadBackendData(session.access_token, user?.id, role);
      setForm({ title:'',description:'',qty:'',unit:'Portions',category:'Meals',area:'',availableFrom:'',pickup:'',allergens:'',storageNotes:'',image:'',imageFile:null });
      setModal('');
      navigate('My listings');
      flash('Your food listing was published.');
    } catch (error) { flash(error?.message || 'Could not publish listing.'); }
  };
  const app = { page, role, session, authReady, user, profile, authLoading, authError, authRestoreFailed, retrySessionRestore, backendLoading, backendErrors, backendOrganizationDocuments, backendAllOrganizationDocuments, backendPublicOrganizations, backendNotifications, backendVolunteerPickups, backendMyFood, backendModerationFood, backendOrganizations, backendReports, backendUsers, backendAudit, backendSettings, clearAuthError, signIn, signUp, logout, updateProfile, loadBackendData, respondToClaim, offerPickup, updateVolunteerPickup, verifyPickup, apiMarkNotificationsRead, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openDonationDetails, openPickupPass, openPickupDetails, updateFoodListing, deleteFoodListing, openAdminRecord, recordAction, submitReport, uploadOrganizationDocument, getOrganizationDocumentViewUrl, savePlatformSetting, addListing, setRole: selectRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, location, roles, routeByPage, navForRole, photo };
  return <AppShell app={app} />;
}

export default App;
