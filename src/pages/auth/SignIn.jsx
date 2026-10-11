import React from 'react';
import { AuthPage } from '../../components/WorkspaceComponents.jsx';

export default function SignInPage({ app }) {
  const { navigate, role, setRole, signIn, authLoading, authError, authRestoreFailed, retrySessionRestore, clearAuthError } = app;
  const handleRoleChange = (nextRole) => { clearAuthError?.(); setRole(nextRole); };
  const handleSignIn = async ({email,password}) => {
    clearAuthError?.();
    await signIn(email,password,role);
  };
  return <AuthPage mode="Sign in" selectedRole={role === 'Admin' ? 'Recipient' : role} onRoleChange={handleRoleChange} onNavigate={navigate} onSignIn={handleSignIn} onRetrySession={retrySessionRestore} showSessionRetry={authRestoreFailed} loading={authLoading} error={authError} />;
}
