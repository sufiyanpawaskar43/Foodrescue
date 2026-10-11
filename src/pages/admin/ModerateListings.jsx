import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function ModerateListingsPage({ app }) {
  const rows = (app.backendModerationFood || app.foods || []).map(f => [f.title, f.donor, f.category, f.time, f.status || 'available', f.id]);
  return <DataPage eyebrow="TRUST & SAFETY" title="Listing moderation" description="Monitor active listings and review anything reported by the community." columns={['Listing','Donor','Category','Expires','Status']} rows={rows} onAction={row=>app.openAdminRecord('listing',row)} actionLabel="Moderate" emptyLabel="No food listings"/>;
}
