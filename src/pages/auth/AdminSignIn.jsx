import React from 'react';
import { AuthPage } from '../../components/WorkspaceComponents.jsx';

export default function AdminSignInPage({ app }) {
  const { navigate, setRole, signIn, authLoading, authError, authRestoreFailed, retrySessionRestore, clearAuthError } = app;
  return <AuthPage mode="Admin sign in" isAdmin onNavigate={navigate} onAdminSignIn={async ({email,password})=>{ clearAuthError?.(); await signIn(email,password,'Admin'); }} onRetrySession={retrySessionRestore} showSessionRetry={authRestoreFailed} loading={authLoading} error={authError} />;
}
