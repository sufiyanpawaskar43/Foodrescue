import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function VolunteerSchedulePage({ app }) {
  const rows=(app.backendVolunteerPickups||[]).filter(p=>!['completed','cancelled'].includes(String(p.status).toLowerCase())).map(p=>{
    const claim=(app.claims||[]).find(c=>String(c.claimId)===String(p.claim_id));
    return [claim?.title||'Food listing',claim?.area||'Area not available',claim?.time||'Time not available',p.status||'requested',p.id];
  });
  return <DataPage eyebrow="VOLUNTEER WORKSPACE" title="Pickup schedule" description="Upcoming handovers you’ve agreed to help with." columns={['Food listing','Pickup area','Pickup by','Status']} rows={rows} onAction={row=>{const pickup=(app.backendVolunteerPickups||[]).find(p=>String(p.id)===String(row[4]));if(pickup)app.openPickupDetails(pickup);}} actionLabel="View details" emptyLabel="Your schedule is clear"/>;
}
