import React from 'react';
import { DashboardPage } from '../../components/WorkspaceComponents.jsx';
export default function DonorDashboard({ app }) { return <DashboardPage role="Donor" app={app} onNavigate={app.navigate} />; }
