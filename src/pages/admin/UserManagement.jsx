import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function UserManagementPage({ app }) {
  const rows = (app.backendUsers || []).map(u => [u.full_name || u.email || 'Member', String(u.role || 'recipient'), (app.backendOrganizations||[]).find(org=>org.owner_id===u.id)?.name || 'No organization profile', u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Date unavailable', u.status, u.id]);
  return <DataPage eyebrow="PLATFORM ADMIN" title="Community members" description="Review account roles, verification and platform access." columns={['Name','Role','Organization','Joined','Status']} rows={rows} onAction={row=>app.openAdminRecord('user',row)} actionLabel="View" emptyLabel="No community members"/>;
}
