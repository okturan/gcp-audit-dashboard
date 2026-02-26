// ── Google Identity Services type declarations ─────────────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

// ── Scopes ─────────────────────────────────────────────────────────────────
export const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform.read-only',
  'https://www.googleapis.com/auth/cloud-billing.readonly',
  'https://www.googleapis.com/auth/monitoring.read',
].join(' ');

// ── Module state ───────────────────────────────────────────────────────────
let _accessToken: string | null = null;
let _expiresAt: number | null = null;

export function getToken(): string | null {
  if (!_accessToken || !_expiresAt) return null;
  if (Date.now() >= _expiresAt - 60_000) return null; // expired / expiring in 60s
  return _accessToken;
}

export function setToken(token: string, expiresIn: number): void {
  _accessToken = token;
  _expiresAt = Date.now() + expiresIn * 1000;
}

export function clearToken(): void {
  if (_accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _expiresAt = null;
}

export function isGISReady(): boolean {
  return !!window.google?.accounts?.oauth2;
}

// ── Sign-in ────────────────────────────────────────────────────────────────
export function requestToken(
  clientId: string,
  onSuccess: (token: string, expiresIn: number) => void,
  onError: (err: string) => void,
  silent = false,
): void {
  if (!isGISReady()) {
    onError('Google Identity Services not loaded. Check your internet connection.');
    return;
  }

  const client = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        onError(response.error_description ?? response.error);
        return;
      }
      setToken(response.access_token, response.expires_in);
      onSuccess(response.access_token, response.expires_in);
    },
    error_callback: (err) => {
      if (err.type !== 'popup_closed') {
        onError(err.message ?? err.type);
      }
    },
  });

  client.requestAccessToken({ prompt: silent ? '' : 'select_account' });
}
