import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button, TextField } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { toE164 } from '@/lib/format';
import { rememberPassword } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

import { AuthShell, fieldErr } from './AuthShell';

export default function Register() {
  const { tr } = useI18n();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState<ApiError | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const phone = toE164(form.phone);
    setPhoneError(phone ? undefined : tr('اكتب رقم موبايل مصري صحيح، زي 01012345678', 'Enter an Egyptian mobile number, like 01012345678'));
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      await post('/auth/register', {
        fullName: form.fullName.trim(),
        identifier: form.email.trim(),
        phone,
        password: form.password,
        confirmPassword: form.confirm,
      });
      rememberPassword(form.password);
      navigate('/verify', { state: { email: form.email.trim(), purpose: 'register', from } });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={tr('اعمل حساب', 'Create an account')} subtitle={tr('هنبعتلك كود على الإيميل تأكد بيه.', "We'll email you a code to confirm it.")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={tr('الاسم بالكامل', 'Full name')} autoComplete="name" value={form.fullName} onChange={set('fullName')} error={fieldErr(error, 'fullName')} />
        <TextField label={tr('الإيميل', 'Email')} type="email" autoComplete="email" dir="ltr" value={form.email} onChange={set('email')} error={fieldErr(error, 'identifier')} />
        <TextField label={tr('رقم الموبايل', 'Mobile number')} type="tel" autoComplete="tel" dir="ltr" placeholder="01012345678" value={form.phone} onChange={set('phone')} error={phoneError ?? fieldErr(error, 'phone')} />
        <TextField label={tr('كلمة السر', 'Password')} type="password" autoComplete="new-password" dir="ltr" value={form.password} onChange={set('password')} error={fieldErr(error, 'password')} hint={tr('8 حروف على الأقل', 'At least 8 characters')} />
        <TextField label={tr('أكد كلمة السر', 'Confirm password')} type="password" autoComplete="new-password" dir="ltr" value={form.confirm} onChange={set('confirm')} error={fieldErr(error, 'confirmPassword')} />
        {error && !error.errors.length && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        <p className="text-xs leading-6 text-ink-soft">
          {tr('بإنك تعمل حساب إنت موافق على ', 'By creating an account you agree to the ')}
          <Link to="/legal/terms" className="underline">{tr('شروط الاستخدام', 'terms of use')}</Link>
          {tr(' و', ' and ')}
          <Link to="/legal/privacy" className="underline">{tr('سياسة الخصوصية', 'privacy policy')}</Link>.
        </p>
        <Button type="submit" className="w-full" loading={loading}>{tr('اعمل الحساب', 'Create account')}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {tr('عندك حساب؟ ', 'Have an account? ')}
        <Link to="/login" className="font-bold text-orange-deep hover:underline">{tr('ادخل', 'Sign in')}</Link>
      </p>
    </AuthShell>
  );
}
