import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { PageShell } from '@/components/Layout';
import { Avatar, Button, errorMessage, TextField, useToast } from '@/components/ui';
import { ApiError, del, patch, upload } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fromE164, toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { User } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

export default function PersonalInfo() {
  const { tr } = useI18n();
  usePageMeta(tr('بياناتي', 'Personal info'));
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(fromE164(user?.phone));
  const [error, setError] = useState<ApiError | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const e164 = toE164(phone);
    setPhoneError(e164 ? undefined : tr('اكتب رقم موبايل مصري صحيح', 'Enter an Egyptian mobile number'));
    if (!e164) return;
    setSaving(true);
    setError(null);
    try {
      setUser(await patch<User>('/users/me', { fullName: fullName.trim(), phone: e164 }));
      toast(tr('اتحفظت بياناتك', 'Saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      setUser(await upload<User>('/users/me/photo', file));
    } catch (err) {
      toast(errorMessage(err, tr('الصورة مترفعتش', "The photo didn't upload")));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      setUser(await del<User>('/users/me/photo'));
    } catch (err) {
      toast(errorMessage(err, tr('محصلش مسح', "Couldn't remove")));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <PageShell title={tr('بياناتي', 'Personal info')}>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar src={user.profilePhotoUrl} name={user.fullName} size={80} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" loading={photoBusy} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {user.profilePhotoUrl ? tr('غيّر الصورة', 'Change photo') : tr('ضيف صورة', 'Add photo')}
            </Button>
            {user.profilePhotoUrl && (
              <Button variant="ghost" size="sm" onClick={removePhoto} disabled={photoBusy} className="text-red-600">
                <Trash2 className="h-4 w-4" />
                {tr('امسح', 'Remove')}
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void changePhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <form onSubmit={save} className="space-y-4" noValidate>
          <TextField label={tr('الاسم بالكامل', 'Full name')} value={fullName} onChange={(e) => setFullName(e.target.value)} error={error?.fieldError('fullName')} />
          <TextField label={tr('الإيميل', 'Email')} value={user.email} dir="ltr" disabled hint={tr('الإيميل مينفعش يتغير.', "Email can't be changed.")} />
          <TextField label={tr('رقم الموبايل', 'Mobile number')} type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError ?? error?.fieldError('phone')} />
          {error && !error.errors.length && <p role="alert" className="text-sm text-red-600">{error.message}</p>}
          <Button type="submit" loading={saving}>{tr('احفظ', 'Save')}</Button>
        </form>
      </div>
    </PageShell>
  );
}
