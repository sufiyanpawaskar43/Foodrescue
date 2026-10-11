import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function VolunteerPickupsPage({ app }) {
  const rows=(app.backendVolunteerPickups||[]).map(p=>{
    const claim=(app.claims||[]).find(c=>String(c.claimId)===String(p.claim_id));
    return [claim?.title||'Food listing',claim?.area||'Area not available',p.created_at?new Date(p.created_at).toLocaleString():'Time not available',p.status||'requested',p.id,p.claim_id];
  });
  return <DataPage eyebrow="YOUR CONTRIBUTION" title="My pickups" description="Track handovers you accepted and their current status." columns={['Food listing','Pickup area','Created','Status']} rows={rows} onAction={row=>{const pickup=(app.backendVolunteerPickups||[]).find(p=>String(p.id)===String(row[4]));if(pickup)app.openPickupDetails(pickup);}} actionLabel={row=>['completed','cancelled'].includes(String(row[3]).toLowerCase())?'View':'Continue'} emptyLabel="No pickups yet"/>;
}
