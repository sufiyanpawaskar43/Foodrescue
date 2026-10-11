import React from 'react';
import { OnboardingPage as WorkspaceOnboardingPage } from '../../components/WorkspaceComponents.jsx';

export default function OnboardingPage({ app }) {
  const { navigate, role, updateProfile, authLoading, authError } = app;
  return <WorkspaceOnboardingPage
    initialRole={role === 'Admin' ? 'Recipient' : role}
    roleLocked={true}
    loading={authLoading}
    error={authError}
    onComplete={async (profile) => {
      await updateProfile(profile);
      const next = profile.role === 'Donor' ? 'Donor dashboard' : profile.role === 'Volunteer' ? 'Volunteer dashboard' : 'Recipient dashboard';
      navigate(next);
    }}
  />;
}
