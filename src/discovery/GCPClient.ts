import { getToken, setToken } from '../auth/GoogleOAuth';
import { useGCPStore } from '../store/useGCPStore';

// Deduplicate concurrent token refresh requests — multiple gcpFetch() calls
// that fire while the token is expired will share a single in-flight refresh.
let _inflightTokenRefresh: Promise<string> | null = null;

// Transparently refresh via gcloud dev server if token is missing/expired.
// Falls back to throwing if neither path works (OAuth session expired).
async function getValidToken(): Promise<string> {
  const stored = getToken();
  if (stored) return stored;

  // Deduplicate concurrent refresh requests
  if (_inflightTokenRefresh) return _inflightTokenRefresh;

  _inflightTokenRefresh = (async () => {
    try {
      const email = useGCPStore.getState().gcloudEmail;
      const accountParam = email ? `?account=${encodeURIComponent(email)}` : '';
      const resp = await fetch(`/api/gcloud-token${accountParam}`);
      if (resp.ok) {
        const data = await resp.json() as { token?: string; email?: string; error?: string };
        if (data.token) {
          setToken(data.token, 3600);
          return data.token;
        }
      }
      throw new Error('Session expired — please sign in again');
    } catch (err) {
      // Re-throw original Error instances, wrap anything else
      if (err instanceof Error) throw err;
      throw new Error('Session expired — please sign in again');
    } finally {
      _inflightTokenRefresh = null;
    }
  })();

  return _inflightTokenRefresh;
}

export async function gcpFetch<T>(url: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const token = await getValidToken();

  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal,
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.warn(`GCP API ${resp.status} ${resp.url}:`, body);

    // Try to extract a meaningful message from GCP's JSON error envelope
    let message = `GCP API error ${resp.status}`;
    try {
      const parsed = JSON.parse(body);
      const errObj = parsed?.error;
      if (errObj?.message) {
        message = errObj.message;
      }
    } catch { /* body wasn't JSON */ }

    throw new Error(message);
  }

  return resp.json() as Promise<T>;
}
