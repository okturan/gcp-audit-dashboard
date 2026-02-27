import { useGCPStore } from '../store/useGCPStore';
import { isGISReady } from '../auth/GoogleOAuth';
import { useState, useEffect } from 'react';

const GIS_POLL_INTERVAL = 500;
const GIS_POLL_TIMEOUT = 30;

const STEPS = [
  {
    n: 1,
    title: 'Create an OAuth Client ID',
    body: (
      <>
        Go to{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#58a6ff' }}
        >
          APIs & Services → Credentials
        </a>{' '}
        in any project (e.g. <code style={{ color: '#58a6ff' }}>service-account-hub</code>).<br />
        <strong style={{ color: '#c9d1d9' }}>+ Create Credentials → OAuth client ID → Web application</strong><br />
        Name it <code style={{ color: '#58a6ff' }}>gcloud-dashboard</code>.
      </>
    ),
  },
  {
    n: 2,
    title: 'Add localhost as an authorised origin',
    body: (
      <>
        Under <strong style={{ color: '#c9d1d9' }}>Authorised JavaScript origins</strong> add:<br />
        <code style={{ color: '#58a6ff' }}>http://localhost:5173</code><br />
        Under <strong style={{ color: '#c9d1d9' }}>Authorised redirect URIs</strong> add the same.<br />
        Click <strong style={{ color: '#c9d1d9' }}>Create</strong> and copy the <strong style={{ color: '#c9d1d9' }}>Client ID</strong> (ends in <code style={{ color: '#8b949e' }}>.apps.googleusercontent.com</code>).
      </>
    ),
  },
  {
    n: 3,
    title: 'Configure the OAuth consent screen',
    body: (
      <>
        Left sidebar →{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials/consent"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#58a6ff' }}
        >
          OAuth consent screen
        </a>
        → <strong style={{ color: '#c9d1d9' }}>External</strong> → fill in app name → add your Gmail as a <strong style={{ color: '#c9d1d9' }}>Test user</strong>.<br />
        <span style={{ color: '#7d8590' }}>You don't need to publish it — test mode is fine for personal use.</span>
      </>
    ),
  },
  {
    n: 4,
    title: 'Paste your Client ID above and sign in',
    body: (
      <>
        Paste the Client ID into the field above and click <strong style={{ color: '#c9d1d9' }}>Sign in with Google</strong>.<br />
        A popup will ask you to authorise read-only access to your GCP account.<br />
        <span style={{ color: '#7d8590' }}>
          The Client ID is not a secret — it's safe to store in your browser.
          Your Google session covers all projects you own automatically.
        </span>
      </>
    ),
  },
];

export function CredentialLoader() {
  const { oauthClientId, setOAuthClientId, signIn, signInWithGcloud, signInError, claudeApiKey, setClaudeApiKey, gcloudAccounts } =
    useGCPStore();
  const [guideOpen, setGuideOpen] = useState(false);
  const [gisReady, setGisReady] = useState(isGISReady());
  const [gisLoadError, setGisLoadError] = useState(false);

  // GIS loads async — poll until ready, timeout after 15s
  useEffect(() => {
    if (gisReady) return;
    let polls = 0;
    const t = setInterval(() => {
      polls++;
      if (isGISReady()) {
        setGisReady(true);
        clearInterval(t);
      } else if (polls >= GIS_POLL_TIMEOUT) {
        clearInterval(t);
        setGisLoadError(true);
      }
    }, GIS_POLL_INTERVAL);
    return () => clearInterval(t);
  }, [gisReady]);

  return (
    <div
      style={{
        height: '100vh',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        padding: 32,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>☁️</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e6edf3', margin: 0 }}>
          GCP Account Dashboard
        </h1>
        <p style={{ color: '#8b949e', fontSize: 14, marginTop: 6 }}>
          Sign in with Google to visualise your entire GCP footprint
        </p>
      </div>

      {/* gcloud CLI accounts */}
      {gcloudAccounts.length > 0 && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <label
            style={{
              display: 'block',
              color: '#8b949e',
              fontSize: 12,
              marginBottom: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            gcloud CLI accounts
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gcloudAccounts.map((acc) => {
              const isSA = acc.email.includes('iam.gserviceaccount.com');
              return (
                <button
                  key={acc.email}
                  onClick={() => signInWithGcloud(acc.email)}
                  style={{
                    width: '100%',
                    background: '#161b22',
                    border: `1px solid ${isSA ? '#d9770633' : '#30363d'}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#e6edf3',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                  className="input-field"
                >
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isSA ? '#1c1a0e' : '#0c1929',
                    border: `1px solid ${isSA ? '#d9770644' : '#1d4778'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    flexShrink: 0,
                  }}>
                    {isSA ? '🔧' : '👤'}
                  </span>
                  <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                    {acc.email}
                  </span>
                  {acc.active && (
                    <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 600, flexShrink: 0 }}>
                      ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '16px 0',
            color: '#7d8590',
            fontSize: 11,
          }}>
            <div style={{ flex: 1, height: 1, background: '#30363d' }} />
            <span>or sign in with OAuth</span>
            <div style={{ flex: 1, height: 1, background: '#30363d' }} />
          </div>
        </div>
      )}

      {/* OAuth Client ID input */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <label
          style={{
            display: 'block',
            color: '#8b949e',
            fontSize: 12,
            marginBottom: 6,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          OAuth Client ID
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="xxxxxxxx.apps.googleusercontent.com"
          value={oauthClientId}
          onChange={(e) => setOAuthClientId(e.target.value)}
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#e6edf3',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Sign in button */}
      <button
        onClick={signIn}
        disabled={!oauthClientId || !gisReady}
        className="btn-primary"
        style={{
          width: '100%',
          maxWidth: 480,
          background: oauthClientId && gisReady ? '#1f6feb' : '#21262d',
          border: 'none',
          borderRadius: 8,
          padding: '12px 24px',
          color: oauthClientId && gisReady ? '#ffffff' : '#7d8590',
          fontSize: 14,
          fontWeight: 600,
          cursor: oauthClientId && gisReady ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'filter 0.15s, box-shadow 0.15s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        {gisLoadError ? 'Sign-in unavailable' : gisReady ? 'Sign in with Google' : 'Loading…'}
      </button>

      {/* GIS load error */}
      {gisLoadError && (
        <div
          style={{
            background: '#2d0f0f',
            border: '1px solid #f8514944',
            borderLeft: '3px solid #f85149',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#f85149',
            fontSize: 13,
            maxWidth: 480,
            width: '100%',
          }}
        >
          Google sign-in failed to load. It may be blocked by an ad blocker or network issue.
          Try disabling extensions or refreshing the page.
        </div>
      )}

      {/* Error */}
      {signInError && (
        <div
          style={{
            background: '#2d0f0f',
            border: '1px solid #f8514944',
            borderLeft: '3px solid #f85149',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#f85149',
            fontSize: 13,
            maxWidth: 480,
            width: '100%',
          }}
        >
          {signInError}
        </div>
      )}

      {/* Claude key */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <label
          style={{
            display: 'block',
            color: '#8b949e',
            fontSize: 12,
            marginBottom: 6,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Claude API Key{' '}
          <span style={{ color: '#7d8590', fontWeight: 400 }}>(optional — for AI analysis)</span>
        </label>
        <input
          type="password"
          className="input-field"
          placeholder="sk-ant-..."
          value={claudeApiKey}
          onChange={(e) => setClaudeApiKey(e.target.value)}
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#e6edf3',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Collapsible setup guide */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <button
          onClick={() => setGuideOpen((o) => !o)}
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: guideOpen ? '8px 8px 0 0' : 8,
            padding: '12px 16px',
            color: '#c9d1d9',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Don't have a Client ID yet? Here's how to get one</span>
          <span style={{ color: '#8b949e' }}>{guideOpen ? '▲' : '▼'}</span>
        </button>

        {guideOpen && (
          <div
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderTop: '1px solid #21262d',
              borderRadius: '0 0 8px 8px',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {STEPS.map((step) => (
              <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#0c1929',
                    border: '1px solid #1d4778',
                    color: '#58a6ff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {step.n}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#8b949e' }}>
                  <div style={{ color: '#c9d1d9', fontWeight: 600, marginBottom: 3 }}>
                    {step.title}
                  </div>
                  {step.body}
                </div>
              </div>
            ))}
            <div
              style={{
                fontSize: 11,
                color: '#7d8590',
                borderTop: '1px solid #21262d',
                paddingTop: 12,
              }}
            >
              The OAuth Client ID is not a secret. Only read-only scopes are requested. Your
              credentials are never sent anywhere except Google's own servers.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
