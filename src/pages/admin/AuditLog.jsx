import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function AuditLogPage({ app }) {
  const members=app.backendUsers||[];
  const rows=(app.backendAudit||[]).map(a=>[
    a.action||'Action',members.find(m=>m.id===a.actor_id)?.full_name||members.find(m=>m.id===a.actor_id)?.email||(a.actor_id?'Platform member':'System'),
    `${a.record_type||'record'}${a.record_id?` · ${String(a.record_id).slice(0,8)}`:''}`,
    a.created_at?new Date(a.created_at).toLocaleString():'Date unavailable','Recorded',a.id
  ]);
  return <DataPage eyebrow="PLATFORM ADMIN" title="Audit log" description="A reviewable timeline of critical platform actions. Identifiers are shortened for readability." columns={['Action','Actor','Record','Date','Result']} rows={rows} onAction={row=>app.openAdminRecord('audit',row)} actionLabel="Review" emptyLabel="No audit events"/>;
}
