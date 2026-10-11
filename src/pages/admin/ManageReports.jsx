import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function ManageReportsPage({ app }) {
  const listings=app.backendModerationFood||[];
  const orgs=app.backendOrganizations||[];
  const rows=(app.backendReports||[]).map(r=>{
    const listing=listings.find(item=>item.id===r.listing_id);
    const org=orgs.find(item=>item.id===r.organization_id);
    const target=listing?.title||org?.name||(r.listing_id?'Food listing record':r.organization_id?'Organization record':'General concern');
    return [target, listing?'Food listing':org?'Organization':'General',r.reason||'No reason provided',r.created_at?new Date(r.created_at).toLocaleString():'Date unavailable',r.status||'open',r.id];
  });
  return <DataPage eyebrow="TRUST & SAFETY" title="Community reports" description="Triage safety and content concerns raised by community members." columns={['Target','Type','Reason','Submitted','Status']} rows={rows} onAction={row=>app.openAdminRecord('report',row)} actionLabel={row=>['resolved','dismissed'].includes(String(row[4]).toLowerCase())?'Completed':'Resolve'} emptyLabel="No reports"/>;
}
