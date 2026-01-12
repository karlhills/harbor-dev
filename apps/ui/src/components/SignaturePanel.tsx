import { useMemo, useState } from 'react';
import type { StoredRequest } from '../lib/api';

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hmacSha256(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseStripeSignature(value: string) {
  const parts = value.split(',');
  const data: Record<string, string> = {};
  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key && val) data[key.trim()] = val.trim();
  }
  return data;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

type SignaturePanelProps = {
  request: StoredRequest;
};

export default function SignaturePanel({ request }: SignaturePanelProps) {
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const stripeHeader = request.headers['stripe-signature'];
  const gitHubSig = request.headers['x-hub-signature-256'];
  const gitHubEvent = request.headers['x-github-event'];

  const showStripe = Boolean(stripeHeader);
  const showGitHub = Boolean(gitHubSig || gitHubEvent);

  const stripeData = useMemo(
    () => (stripeHeader ? parseStripeSignature(stripeHeader) : null),
    [stripeHeader],
  );

  const handleVerify = async () => {
    if (!gitHubSig) return;
    setIsVerifying(true);
    setStatus(null);
    try {
      const expected = gitHubSig.replace('sha256=', '');
      const actual = await hmacSha256(secret, request.rawBody);
      const matches = timingSafeEqual(hexToBytes(actual), hexToBytes(expected));
      setStatus(matches ? 'Signature verified.' : 'Signature does not match.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!showStripe && !showGitHub) return null;

  return (
    <div className="rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4 text-sm text-slate-200">
      <div className="text-sm font-semibold text-slate-200">Signature</div>
      <div className="mt-3 grid gap-4">
        {showGitHub ? (
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">GitHub</div>
            {gitHubEvent ? <div className="text-xs">Event: {gitHubEvent}</div> : null}
            {gitHubSig ? <div className="text-xs">Signature: {gitHubSig}</div> : null}
            <div className="flex flex-col gap-2">
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Paste webhook secret"
                className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
              />
              <button
                onClick={handleVerify}
                disabled={!secret || !gitHubSig || isVerifying}
                className="w-fit rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-1.5 text-xs text-slate-100 hover:border-accent-500/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : 'Verify GitHub signature'}
              </button>
              {status ? <div className="text-xs text-slate-400">{status}</div> : null}
            </div>
          </div>
        ) : null}
        {showStripe ? (
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stripe</div>
            <div className="text-xs text-slate-400">
              Verification not implemented yet. Parsed fields below.
            </div>
            {stripeData ? (
              <div className="grid gap-1 text-xs">
                {Object.entries(stripeData).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-slate-500">{key}:</span> {value}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
