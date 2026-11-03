import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { Button, TextField, useToast } from '@/components/ui';
import { ApiError, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

export default function DeleteAccount() {
  const { tr } = useI18n();
  usePageMeta(tr('مسح الحساب', 'Delete account'));
  const { user, forget } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await del('/users/me', { password });
      forget();
      toast(tr('اتمسح حسابك', 'Your account was deleted'));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('محصلش مسح', "Couldn't delete"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={tr('امسح الحساب', 'Delete account')}>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
        <p className="leading-7">
          {tr(
            'هنمسح حسابك وكل إعلاناتك وصورها ومحفوظاتك. ده مينفعش يترجع.',
            'This deletes your account, all your listings and their photos, and your saved parts. It cannot be undone.',
          )}
        </p>
        {user.hasPassword ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextField label={tr('اكتب كلمة السر للتأكيد', 'Enter your password to confirm')} type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
            <Button type="submit" variant="danger" loading={busy} disabled={!password}>{tr('امسح حسابي نهائياً', 'Delete my account')}</Button>
          </form>
        ) : (
          <p className="mt-5 rounded-xl bg-navy-mist p-4 text-sm">
            {tr(
              'حسابك متعمل بجوجل. اعمل كلمة سر الأول من صفحة الحساب، أو امسحه من تطبيق عربيتي.',
              'Your account uses Google sign-in. Set a password first from your account, or delete it from the 3arabity app.',
            )}
          </p>
        )}
      </div>
    </PageShell>
  );
}
