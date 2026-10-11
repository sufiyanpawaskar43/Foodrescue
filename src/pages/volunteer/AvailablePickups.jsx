import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function AvailablePickupsPage({ app }) {
  const assigned=new Set((app.backendVolunteerPickups||[]).filter(p=>p.status!=='cancelled').map(p=>String(p.claim_id)));
  const available=(app.claims||[]).filter(c=>c.status==='approved'&&!assigned.has(String(c.claimId)));
  const rows=available.map(c=>[c.title||'Food listing',c.donor||'Community donor',c.area||'Area not available',c.time||'Pickup time not listed',c.claimId]);
  return <DataPage eyebrow="HELP GOOD FOOD GET THERE" title="Available pickups" description="View approved handovers that still need volunteer assistance." columns={['Food listing','Donor','Pickup area','Pickup by']} rows={rows} onAction={row=>{const claim=available.find(c=>String(c.claimId)===String(row[4]));if(claim)app.openPickupDetails(claim);}} actionLabel="View details" emptyLabel="No approved, unassigned pickups are available"/>;
}
