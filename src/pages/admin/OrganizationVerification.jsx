import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';
export default function OrganizationVerificationPage({ app }) {
  const docs=app.backendAllOrganizationDocuments||[];
  const rows=(app.backendOrganizations||[]).map(o=>[
    o.name,o.organization_type||'Organization',o.created_at?new Date(o.created_at).toLocaleDateString():'Date unavailable',
    `${docs.filter(doc=>doc.organization_id===o.id).length} files`,o.verification_status||'pending',o.id
  ]);
  return <DataPage eyebrow="TRUST & SAFETY" title="Organization verification" description="Review partner profiles and the private documents submitted for verification." columns={['Organization','Type','Submitted','Documents','Status']} rows={rows} onAction={row=>app.openAdminRecord('organization',row)} actionLabel="Review" emptyLabel="No organizations to review"/>;
}
