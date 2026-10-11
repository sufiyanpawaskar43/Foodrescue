import React, { useState } from 'react';
import { ScreenHeading } from '../../components/WorkspaceComponents.jsx';
export default function ReportIssuePage({ app }) {
  const [reason,setReason]=useState('Food safety concern');
  const [listingId,setListingId]=useState('');
  const [organizationId,setOrganizationId]=useState('');
  const [description,setDescription]=useState('');
  const submit=async()=>{
    if(!listingId && !organizationId){ app.flash('Select a listing or organization to report.'); return; }
    if(!description.trim()){ app.flash('Describe the concern before submitting.'); return; }
    const ok=await app.submitReport({listingId:listingId||null,organizationId:organizationId||null,reason,description});
    if(ok){setDescription('');setListingId('');setOrganizationId('');}
  };
  return <><ScreenHeading eyebrow="COMMUNITY CARE" title="Report a concern" description="Help us keep FoodRescue safe and trustworthy for everyone."/><div className="onboarding-profile"><h2>What should we know?</h2><label>What are you reporting?<select value={reason} onChange={e=>setReason(e.target.value)}><option>Food safety concern</option><option>Incorrect listing information</option><option>Organization or account</option><option>Pickup issue</option><option>Other</option></select></label><label>Food listing (optional)<select value={listingId} onChange={e=>{setListingId(e.target.value);setOrganizationId('')}}><option value="">Select a listing</option>{(app.foods||[]).map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label><label>Organization (optional)<select value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setListingId('')}}><option value="">Select an organization</option>{(app.backendPublicOrganizations?.length ? app.backendPublicOrganizations : app.backendOrganizations||[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Describe the concern<textarea rows="5" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Share the details our moderation team needs to review."/></label><button className="btn btn-primary btn-large" onClick={submit}>Submit report <span>→</span></button><p className="privacy-note">Reports are reviewed by the platform team. For an urgent safety concern, do not collect the food.</p></div></>;
}
