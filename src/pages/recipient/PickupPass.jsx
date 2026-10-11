import React from 'react';
import { PickupPassPage as PickupPassView } from '../../components/WorkspaceComponents.jsx';

export default function PickuppassPage({ app }) {
  const routeId = decodeURIComponent(app.location.pathname.split('/').filter(Boolean).at(-1) || '');
  const claim = (app.claims || []).find(item => String(item.claimId) === routeId && item.status === 'approved') || null;
  return <PickupPassView food={claim} onBack={()=>app.navigate('My claims')} />;
}
