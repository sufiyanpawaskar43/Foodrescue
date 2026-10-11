import React from 'react';
import { DashboardPage } from '../../components/WorkspaceComponents.jsx';
export default function RecipientDashboard({ app }) { return <DashboardPage role="Recipient" app={app} onNavigate={app.navigate} />; }
