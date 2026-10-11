import React from 'react';
import { DashboardPage } from '../../components/WorkspaceComponents.jsx';
export default function VolunteerDashboard({ app }) { return <DashboardPage role="Volunteer" app={app} onNavigate={app.navigate} />; }
