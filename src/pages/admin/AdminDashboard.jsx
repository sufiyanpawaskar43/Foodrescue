import React from 'react';
import { DashboardPage } from '../../components/WorkspaceComponents.jsx';
export default function AdminDashboard({ app }) { return <DashboardPage role="Admin" app={app} onNavigate={app.navigate} />; }
