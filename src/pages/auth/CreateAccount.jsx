import React from 'react';
import { AuthPage } from '../../components/WorkspaceComponents.jsx';

export default function CreateAccountPage({ app }) {
  const { navigate, role, setRole, signUp, authLoading, authError, clearAuthError } = app;
  const handleRoleChange = (nextRole) => { clearAuthError?.(); setRole(nextRole); };
  const handleCreateAccount = async ({email,password}) => {
    clearAuthError?.();
    await signUp(email,password,role);
  };
  return <AuthPage mode="Create account" selectedRole={role} onRoleChange={handleRoleChange} onNavigate={navigate} onCreateAccount={handleCreateAccount} loading={authLoading} error={authError} />;
}
