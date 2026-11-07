import React from 'react';
import { useGoogleLogin, type TokenResponse } from '@react-oauth/google';
import { MASTER_CONTROL_OAUTH_SCOPES } from '../data/api';
import { CALENDAR_SCOPE } from '../data/calendar';

interface GoogleSignInProps {
  scriptConfigured: boolean;
  error: string | null;
  onError: (message: string) => void;
  onToken: (token: TokenResponse) => void;
  onExploreDemo?: () => void;
}

export const GoogleSignIn: React.FC<GoogleSignInProps> = ({
  scriptConfigured,
  error,
  onError,
  onToken,
  onExploreDemo,
}) => {
  const signIn = useGoogleLogin({
    flow: 'implicit',
    // Master Control's script scopes, plus read-only Calendar for the Calendar bay (browser only, owner 2026-11-06).
    scope: [...MASTER_CONTROL_OAUTH_SCOPES, CALENDAR_SCOPE].join(' '),
    onSuccess: (token) => {
      console.info('Google OAuth sign-in succeeded.');
      onToken(token);
    },
    onError: (response) => {
      console.error('❌ Google OAuth Error Response:', response);
      onError(response.error_description || response.error || 'Google sign-in was not completed.');
    },
    onNonOAuthError: (nonOAuthError) => {
      console.error('❌ Google Non-OAuth Error:', nonOAuthError);
      onError(nonOAuthError.type || 'Non-OAuth error occurred during sign-in.');
    },
  });

  return (
    <div className="w-full max-w-sm">
      <button
        type="button"
        onClick={() => signIn()}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-accent-teal bg-accent-teal/15 px-5 py-3 font-display text-sm font-bold text-text-mana transition hover:bg-accent-teal/30 cursor-pointer"
      >
        <i className="fa-brands fa-google text-alert-orange" aria-hidden="true" />
        Sign in with Google
      </button>
      {onExploreDemo && (
        <button
          type="button"
          onClick={onExploreDemo}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-highlight-gold/40 bg-highlight-gold/10 px-5 py-2.5 font-display text-xs font-bold text-highlight-gold transition hover:bg-highlight-gold/20 cursor-pointer"
        >
          <i className="fa-solid fa-compass" aria-hidden="true" />
          Explore Command HUD (Demo Fleet)
        </button>
      )}
      {!scriptConfigured && (
        <p className="mt-3 text-center font-mono text-xs text-alert-orange" role="status">
          Google sign-in can be tested now; configure VITE_APPS_SCRIPT_DEPLOYMENT_ID to load live HUD data.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 font-mono text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
      <p className="mt-4 text-center font-mono text-hud-3 text-text-mana/50">
        Your Google access token stays in memory and is cleared when you sign out or it expires.
      </p>
    </div>
  );
};
