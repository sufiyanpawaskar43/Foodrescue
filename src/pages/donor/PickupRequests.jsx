import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function PickupRequestsPage({ app }) {
  const rows = (app.claims || []).filter(c=>c.status==='pending').map(c=>[c.recipient_name || 'Community recipient',c.title || 'Food listing',c.claimed_at?new Date(c.claimed_at).toLocaleString():'Date unavailable',c.status||'pending',c.claimId || c.id]);
  return <DataPage eyebrow="DONOR WORKSPACE" title="Pickup requests" description="Review claims from verified community organizations." columns={['Recipient','Food listing','Requested','Claim status']} rows={rows} onAction={row=>app.respondToClaim?.(row[4],'approve')} actionLabel="Approve" onSecondaryAction={row=>app.respondToClaim?.(row[4],'reject')} secondaryActionLabel="Decline" emptyLabel="No pending pickup requests"/>;
}
