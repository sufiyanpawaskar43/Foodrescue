import React from 'react';
import { DashboardPage, AdminRecordPage, AuthPage, DataPage, FoodDetailPage, InteractiveMapPage, ListingFormPage, NotificationsPage, OnboardingPage, ProfileSettingsPage, QRVerificationPage, PickupPassPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';

import Icon from '../../components/Icon.jsx';
import Brand from '../../components/Brand.jsx';
import FoodCard from '../../components/FoodCard.jsx';
import PageHeading from '../../components/PageHeading.jsx';
import Step from '../../components/Step.jsx';
import Empty from '../../components/Empty.jsx';

export default function AdminRecord({ app }) {
  const { routeRecord, page, role, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openAdminRecord, recordAction, addListing, setRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, routeByPage, roles, location } = app;
  const kind = {'Organization review':'organization','Listing review':'listing','Report review':'report','User detail':'user','Audit detail':'audit'}[page];
  const recordId = decodeURIComponent(location.pathname.split('/').filter(Boolean).filter(part=>part!=='review').at(-1) || '');
  const org = (app.backendOrganizations||[]).find(x=>x.id===recordId);
  const listing = (app.backendModerationFood||[]).find(x=>x.id===recordId);
  const report = (app.backendReports||[]).find(x=>x.id===recordId);
  const user = (app.backendUsers||[]).find(x=>x.id===recordId);
  const audit = (app.backendAudit||[]).find(x=>x.id===recordId);
  const actualRecord = kind==='organization' && org ? [org.name,org.organization_type,org.created_at?new Date(org.created_at).toLocaleDateString():'Date unavailable',`${(app.backendAllOrganizationDocuments||[]).filter(doc=>doc.organization_id===org.id).length} files`,org.verification_status,org.id]
    : kind==='listing' && listing ? [listing.title,listing.donor,listing.category,listing.time,listing.status,listing.id]
    : kind==='report' && report ? [report.reason,(app.backendModerationFood||[]).find(item=>item.id===report.listing_id)?.title||(app.backendOrganizations||[]).find(item=>item.id===report.organization_id)?.name||(report.listing_id?'Food listing record':report.organization_id?'Organization record':'General concern'),report.description||report.reason,report.created_at?new Date(report.created_at).toLocaleString():'Date unavailable',report.status,report.id]
    : kind==='user' && user ? [user.full_name||user.email,user.role,(app.backendOrganizations||[]).find(item=>item.owner_id===user.id)?.name||'No organization profile',user.created_at?new Date(user.created_at).toLocaleDateString():'Date unavailable',user.status,user.id]
    : kind==='audit' && audit ? [audit.action,(app.backendUsers||[]).find(item=>item.id===audit.actor_id)?.full_name||(audit.actor_id?'Platform member':'System'),`${audit.record_type||'record'} ${audit.record_id?String(audit.record_id).slice(0,8):''}`.trim(),audit.created_at?new Date(audit.created_at).toLocaleString():'Date unavailable','Recorded',audit.id]
    : null;
  const record = (selectedAdminRecord && String(selectedAdminRecord[5])===recordId) ? selectedAdminRecord : actualRecord;
  const organizationDocuments=(app.backendAllOrganizationDocuments||[]).filter(doc=>doc.organization_id===recordId);
  if (!record) return <><ScreenHeading eyebrow="PLATFORM ADMIN" title="Record not found" description="This record is not present in the current Supabase data. Refresh the list and select an existing record."/><button className="btn btn-outline" onClick={()=>navigate({'Organization review':'Organization verification','Listing review':'Moderate listings','Report review':'Manage reports','User detail':'User management','Audit detail':'Audit log'}[page])}>← Back to list</button></>;
  return (<AdminRecordPage kind={kind} record={record} documents={organizationDocuments} onGetDocumentUrl={app.getOrganizationDocumentViewUrl} onBack={()=>navigate({ 'Organization review':'Organization verification','Listing review':'Moderate listings','Report review':'Manage reports','User detail':'User management','Audit detail':'Audit log'}[page])} onAction={recordAction}/>);
}
