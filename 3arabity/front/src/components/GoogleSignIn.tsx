import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuthResult } from '@/lib/types';

import { Button, Dialog, TextField } from './ui';

/** The web OAuth client (the server's GOOGLE_CLIENT_IDS lists it); empty hides the button. */
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

type GoogleId = {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: 'popup' }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let script: Promise<GoogleId> | null = null;
/** Google Identity Services, loaded once and only on pages that show the button. */
function loadGoogle(): Promise<GoogleId> {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'https://accounts.google.com/gsi/client';
    tag.async = true;
    tag.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('gsi')));
    tag.onerror = () => {
      script = null;
      reject(new Error('gsi'));
    };
    document.head.appendChild(tag);
  });
  return script;
}

/**
 * "Continue with Google" for the sign-in and sign-up pages. A first sign-in
 * asks for the mobile number Google doesn't give, then makes the account.
 */
export function GoogleSignIn({ from, rememberMe = true }: { from: string; rememberMe?: boolean }) {
  const { tr, lang } = useI18n();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string>();
  // Set once the server asks for a phone to finish a new account.
  const [pending, setPending] = useState<{ idToken: string; fullName: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // The callback outlives renders; keep it reading the latest props.
  const send = useRef<(idToken: string) => void>(() => {});
  send.current = async (idToken: string) => {
    setError(undefined);
    try {
      await signIn(await post<AuthResult>('/auth/google', { idToken, rememberMe }));
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PHONE_REQUIRED') {
        setPending({ idToken, fullName: String(err.details.fullName ?? '') });
        return;
      }
      setError(err instanceof ApiError ? err.message : tr('حصلت مشكلة، حاول تاني', 'Something went wrong'));
    }
  };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let live = true;
    loadGoogle()
      .then((id) => {
        const parent = slot.current;
        if (!live || !parent) return;
        id.initialize({ client_id: CLIENT_ID, callback: ({ credential }) => send.current(credential), ux_mode: 'popup' });
        parent.replaceChildren();
        id.renderButton(parent, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: lang,
          // Google takes a fixed width; match the form's, up to its 400px limit.
          width: Math.min(Math.max(box.current?.clientWidth ?? 0, 240), 400),
        });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [lang]);

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    const e164 = toE164(phone);
    setPhoneError(e164 ? undefined : tr('اكتب رقم موبايل مصري صحيح، زي 01012345678', 'Enter an Egyptian mobile number, like 01012345678'));
    if (!e164) return;
    setSaving(true);
    try {
      const body = { idToken: pending.idToken, phone: e164, fullName: pending.fullName.trim() || undefined, rememberMe };
      await signIn(await post<AuthResult>('/auth/google', body));
      setPending(null);
      navigate(from, { replace: true });
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      setPhoneError(apiError?.fieldError('phone') ?? apiError?.message ?? tr('حصلت مشكلة، حاول تاني', 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  };

  if (!CLIENT_ID || failed) return null;
  return (
    <div ref={box} className="mt-6">
      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        {tr('أو', 'or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={slot} className="mt-4 flex h-11 justify-center" />
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Dialog open={pending !== null} onClose={() => setPending(null)} title={tr('خطوة أخيرة', 'One last step')}>
        <form onSubmit={finish} className="space-y-4" noValidate>
          <p className="text-sm text-ink-soft">
            {tr('اكتب رقم موبايلك عشان المشترين يكلموك ونكمّل حسابك.', 'Add your mobile number so buyers can reach you, and we’ll finish your account.')}
          </p>
          <TextField
            label={tr('الاسم بالكامل', 'Full name')}
            autoComplete="name"
            value={pending?.fullName ?? ''}
            onChange={(e) => setPending((p) => p && { ...p, fullName: e.target.value })}
          />
          <TextField label={tr('رقم الموبايل', 'Mobile number')} type="tel" autoComplete="tel" dir="ltr" placeholder="01012345678" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError} autoFocus />
          <Button type="submit" className="w-full" loading={saving}>{tr('كمّل', 'Continue')}</Button>
        </form>
      </Dialog>
    </div>
  );
}
