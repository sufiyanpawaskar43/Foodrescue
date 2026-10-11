import React, { useState } from 'react';
import { ScreenHeading } from '../../components/WorkspaceComponents.jsx';

export default function PickupDetailsPage({ app }) {
  const routeId=decodeURIComponent(app.location.pathname.split('/').filter(Boolean).at(-1)||'');
  const claim=(app.claims||[]).find(c=>String(c.claimId)===routeId)||null;
  // Cancelled assignments release the claim back to the available queue and must
  // not block another volunteer from accepting it again.
  const pickup=(app.backendVolunteerPickups||[]).find(p=>String(p.claim_id)===routeId&&String(p.status).toLowerCase()!=='cancelled')||null;
  const [busy,setBusy]=useState(false);
  const status=String(pickup?.status||'').toLowerCase();
  const doAction=async(fn)=>{if(busy)return;setBusy(true);try{await fn();}finally{setBusy(false)}};
  if(!routeId||!claim){return <><ScreenHeading eyebrow="VOLUNTEER PICKUP" title="Pickup not found" description={app.backendLoading?'Loading pickup details…':'This pickup does not exist, is not available to your account, or could not be loaded.'}/><button className="btn btn-outline" onClick={()=>app.navigate('Available pickups')}>← Available pickups</button></>;}
  const canAccept=claim.status==='approved'&&!pickup;
  const canStart=status==='accepted';
  const canVerify=status==='in_progress';
  return <><ScreenHeading eyebrow="VOLUNTEER PICKUP" title={claim.title||'Pickup details'} description="Review the record and update the handover only after the actual pickup step is complete." action={<button className="btn btn-outline" onClick={()=>app.navigate('Volunteer pickups')}>← My pickups</button>}/>
    <div className="onboarding-profile"><h2>{claim.title||'Food listing'}</h2><p>{claim.donor||'Community donor'} · {claim.qty||''}</p><div className="detail-facts"><span>⌖ <strong>{claim.area||'Area not available'}</strong></span><span>◷ <strong>{claim.time||'Pickup time not listed'}</strong></span><span><strong>Status: {pickup?.status||claim.status}</strong></span></div>
      <div className="area-note"><span>⌖</span><span><strong>Approximate pickup area</strong><small>FoodRescue does not expose private street addresses here. Coordinate exact handover details with the donor.</small></span></div>
      {claim.status!=='approved'&&<div className="form-note">Only donor-approved claims can be assigned to a volunteer.</div>}
      {canAccept&&<button className="btn btn-primary btn-large" disabled={busy} onClick={()=>doAction(async()=>{await app.offerPickup(claim.claimId);})}>{busy?'Accepting…':'Accept this pickup'} <span>↗</span></button>}
      {canStart&&<button className="btn btn-primary btn-large" disabled={busy} onClick={()=>doAction(async()=>{await app.updateVolunteerPickup(pickup.id,'in_progress');})}>{busy?'Updating…':'Mark food collected'} <span>→</span></button>}
      {canVerify&&<button className="btn btn-primary btn-large" onClick={()=>app.navigate('Pickup verification')}>Verify handover <span>→</span></button>}
      {pickup&&['completed','cancelled'].includes(status)&&<p className="verify-success">{status==='completed'?'This pickup is complete.':'This pickup was cancelled.'}</p>}
      {pickup&&status==='requested'&&<p className="form-note">This pickup was requested but is not yet accepted. Contact the platform administrator if it remains stuck.</p>}
    </div>
  </>;
}
