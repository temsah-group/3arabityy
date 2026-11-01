import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Clock, ExternalLink, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { Avatar, Button, cx, ErrorState, errorMessage, Field, Img, PageSpinner, Select, Textarea, TextField, useToast } from '@/components/ui';
import { ApiError, get, patch, post, upload } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, GOVERNORATES, useLabels } from '@/lib/catalog';
import { fromE164, toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Category, Shop, ShopInput } from '@/lib/types';

interface Form {
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  city: string;
  address: string;
  hours: string;
  brandIds: string[];
  categories: Category[];
  deliveryAvailable: boolean;
  governorates: string[];
  feeFrom: string;
  feeTo: string;
  eta: string;
  note: string;
}

const toForm = (s: Shop | null, phone: string): Form => ({
  name: s?.name ?? '',
  description: s?.description ?? '',
  phone: fromE164(s?.phone ?? phone),
  whatsapp: fromE164(s?.whatsapp),
  city: s?.city ?? '',
  address: s?.address ?? '',
  hours: s?.hours ?? '',
  brandIds: s?.brandIds ?? [],
  categories: s?.categories ?? [],
  deliveryAvailable: s?.delivery.available ?? false,
  governorates: s?.delivery.governorates ?? [],
  feeFrom: s?.delivery.feeFrom != null ? String(s.delivery.feeFrom) : '',
  feeTo: s?.delivery.feeTo != null ? String(s.delivery.feeTo) : '',
  eta: s?.delivery.eta ?? '',
  note: s?.delivery.note ?? '',
});

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={cx('rounded-full px-3 py-1.5 text-sm font-bold ring-1', on ? 'bg-navy text-white ring-navy' : 'bg-white ring-line hover:ring-navy')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusCard({ shop }: { shop: Shop }) {
  const { tr } = useI18n();
  const map = {
    PENDING: { icon: Clock, cls: 'bg-amber-50 text-amber-800', title: tr('طلبك بيتراجع', 'Under review'), body: tr('هنراجع بيانات المحل ونبلغك. المشترين مش هيشوفوه لحد ما يتوافق عليه.', "We're reviewing your shop. Buyers won't see it until it's approved.") },
    APPROVED: { icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-800', title: tr('محلك ظاهر للمشترين', 'Your shop is live'), body: tr('كل إعلاناتك بتظهر تحت اسم المحل.', 'All your listings show under the shop.') },
    REJECTED: { icon: ShieldAlert, cls: 'bg-red-50 text-red-800', title: tr('الطلب اترفض', 'Not approved'), body: tr('عدّل البيانات وابعته تاني.', 'Fix the details and send it again.') },
    SUSPENDED: { icon: ShieldAlert, cls: 'bg-red-50 text-red-800', title: tr('المحل موقوف', 'Shop suspended'), body: tr('كلّم الدعم لو محتاج تعرف أكتر.', 'Contact support to learn more.') },
  } as const;
  const s = map[shop.status ?? 'PENDING'];
  const Icon = s.icon;
  return (
    <div className={cx('flex gap-3 rounded-2xl p-4', s.cls)}>
      <Icon className="h-6 w-6 shrink-0" />
      <div>
        <p className="font-extrabold">{s.title}</p>
        <p className="text-sm">{s.body}</p>
        {shop.statusReason && <p className="mt-1 text-sm font-bold">{tr('السبب: ', 'Reason: ')}{shop.statusReason}</p>}
        {shop.status === 'APPROVED' && (
          <Link to={`/shops/${shop.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold underline">
            {tr('شوف صفحة المحل', 'View shop page')} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function Images({ shop, onChange }: { shop: Shop; onChange: (s: Shop) => void }) {
  const { tr } = useI18n();
  const toast = useToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const send = async (kind: 'logo' | 'cover', file?: File) => {
    if (!file) return;
    try {
      onChange(await upload<Shop>(`/shops/mine/${kind}`, file));
    } catch (e) {
      toast(errorMessage(e, tr('الصورة مترفعتش', "The photo didn't upload")));
    }
  };
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <button type="button" onClick={() => coverRef.current?.click()} className="relative block h-32 w-full bg-navy">
        {shop.coverUrl && <Img src={shop.coverUrl} alt="" className="h-full w-full" />}
        <span className="absolute end-3 top-3 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-navy">
          <Camera className="h-4 w-4" />
          {tr('صورة الغلاف', 'Cover photo')}
        </span>
      </button>
      <div className="flex items-center gap-3 p-4">
        <button type="button" onClick={() => logoRef.current?.click()} className="relative -mt-12 rounded-2xl bg-white p-1 ring-1 ring-line" aria-label={tr('اللوجو', 'Logo')}>
          {shop.logoUrl ? <Img src={shop.logoUrl} alt="" className="h-20 w-20 rounded-xl" /> : <Avatar src={null} name={shop.name} size={80} />}
          <Camera className="absolute bottom-1 end-1 h-6 w-6 rounded-full bg-orange p-1 text-white" />
        </button>
        <p className="text-sm text-ink-soft">{tr('اللوجو والغلاف بيظهروا للمشترين في صفحة المحل.', 'Buyers see the logo and cover on your shop page.')}</p>
      </div>
      <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void send('logo', e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void send('cover', e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export default function MyShop() {
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const shop = useQuery({ queryKey: ['me', 'shop'], queryFn: () => get<Shop | null>('/shops/mine') });
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(null, user?.phone ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop.data) setForm(toForm(shop.data, user?.phone ?? ''));
  }, [shop.data, user?.phone]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setShop = (s: Shop) => queryClient.setQueryData(['me', 'shop'], s);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const phone = toE164(form.phone);
    const whatsapp = form.whatsapp ? toE164(form.whatsapp) : null;
    const local: Record<string, string> = {};
    if (!phone) local.phone = tr('اكتب رقم موبايل مصري صحيح', 'Enter an Egyptian mobile number');
    if (form.whatsapp && !whatsapp) local.whatsapp = tr('اكتب رقم موبايل مصري صحيح', 'Enter an Egyptian mobile number');
    if (!form.city) local.city = tr('اختار المحافظة', 'Choose a governorate');
    if (form.deliveryAvailable && !form.governorates.length) local.governorates = tr('اختار محافظة واحدة على الأقل', 'Choose at least one governorate');
    setErrors(local);
    if (Object.keys(local).length) return;

    const body: ShopInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      phone: phone!,
      whatsapp,
      city: form.city,
      address: form.address.trim(),
      hours: form.hours.trim() || null,
      brandIds: form.brandIds,
      categories: form.categories,
      delivery: {
        available: form.deliveryAvailable,
        governorates: form.deliveryAvailable ? form.governorates : [],
        feeFrom: form.feeFrom ? Number(form.feeFrom) : null,
        feeTo: form.feeTo ? Number(form.feeTo) : null,
        eta: form.eta.trim() || null,
        note: form.note.trim() || null,
      },
    };
    setSaving(true);
    try {
      const saved = shop.data ? await patch<Shop>('/shops/mine', body) : await post<Shop>('/shops', body);
      setShop(saved);
      setApplying(false);
      toast(shop.data ? tr('اتحفظت التعديلات', 'Changes saved') : tr('وصلنا طلبك، هنراجعه', "Application sent, we'll review it"));
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {};
        err.errors.forEach((x) => (map[x.field.split('.').pop()!] = x.message));
        setErrors(map);
      }
      toast(errorMessage(err, tr('محصلش حفظ', "Couldn't save")));
    } finally {
      setSaving(false);
    }
  };

  if (shop.isLoading) return <PageShell title={tr('محلي', 'My shop')}><PageSpinner /></PageShell>;
  if (shop.isError) return <PageShell title={tr('محلي', 'My shop')}><ErrorState error={shop.error} onRetry={() => shop.refetch()} /></PageShell>;

  const s = shop.data;
  if (!s && !applying) {
    return (
      <PageShell title={tr('محلي', 'My shop')}>
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-line md:p-10">
          <Store className="mx-auto h-12 w-12 text-navy" />
          <h2 className="mt-3 text-xl font-extrabold">{tr('عندك محل قطع غيار؟', 'Do you run a parts shop?')}</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            {tr('قدّم بيانات محلك، وبعد المراجعة إعلاناتك هتظهر تحت اسمه مع العنوان والمواعيد والتوصيل والتقييمات.', 'Send your shop details. Once approved, your listings show under it with its address, hours, delivery and reviews.')}
          </p>
          <Button className="mt-5" onClick={() => setApplying(true)}>{tr('قدّم محلك', 'Apply with your shop')}</Button>
        </div>
      </PageShell>
    );
  }

  const suspended = s?.status === 'SUSPENDED';

  return (
    <PageShell title={s ? tr('محلي', 'My shop') : tr('قدّم محلك', 'Apply with your shop')}>
      {s && (
        <div className="mb-5 space-y-4">
          <StatusCard shop={s} />
          {!suspended && <Images shop={s} onChange={setShop} />}
        </div>
      )}
      {!suspended && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-line md:p-6" noValidate>
          <TextField label={tr('اسم المحل', 'Shop name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={60} />
          <Field label={tr('عن المحل (اختياري)', 'About the shop (optional)')} error={errors.description}>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={tr('رقم التليفون', 'Phone')} type="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
            <TextField label={tr('واتساب (اختياري)', 'WhatsApp (optional)')} type="tel" dir="ltr" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} error={errors.whatsapp} />
          </div>
          <Field label={tr('المحافظة', 'Governorate')} error={errors.city}>
            <Select value={form.city} onChange={(e) => set('city', e.target.value)}>
              <option value="">{tr('اختار', 'Choose')}</option>
              {GOVERNORATES.map((g) => <option key={g} value={g}>{labels.city(g)}</option>)}
            </Select>
          </Field>
          <TextField label={tr('العنوان', 'Address')} placeholder={tr('الشارع والمنطقة', 'Street and area')} value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} maxLength={200} />
          <TextField label={tr('المواعيد (اختياري)', 'Opening hours (optional)')} placeholder={tr('يومياً 10ص – 10م', 'Daily 10am – 10pm')} value={form.hours} onChange={(e) => set('hours', e.target.value)} error={errors.hours} maxLength={100} />
          <Field label={tr('الماركات اللي بتشتغل عليها', 'Makes you carry')}>
            <Chips options={labels.brands.map((b) => ({ id: b.id, label: lang === 'ar' ? b.nameAr : b.nameEn }))} value={form.brandIds} onChange={(v) => set('brandIds', v)} />
          </Field>
          <Field label={tr('الأقسام', 'Categories')}>
            <Chips options={CATEGORIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} value={form.categories} onChange={(v) => set('categories', v)} />
          </Field>

          <fieldset className="space-y-4 rounded-xl bg-canvas p-4">
            <label className="flex items-center gap-3 font-bold">
              <input type="checkbox" checked={form.deliveryAvailable} onChange={(e) => set('deliveryAvailable', e.target.checked)} className="h-5 w-5 accent-navy" />
              {tr('بنوصّل', 'We deliver')}
            </label>
            {form.deliveryAvailable && (
              <>
                <Field label={tr('بنوصّل لـ', 'Delivery areas')} error={errors.governorates}>
                  <Chips options={GOVERNORATES.map((g) => ({ id: g, label: labels.city(g) }))} value={form.governorates} onChange={(v) => set('governorates', v)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label={tr('التوصيل من (ج.م)', 'Fee from (EGP)')} type="number" min={0} value={form.feeFrom} onChange={(e) => set('feeFrom', e.target.value)} error={errors.feeFrom} />
                  <TextField label={tr('لحد (ج.م)', 'Fee up to (EGP)')} type="number" min={0} value={form.feeTo} onChange={(e) => set('feeTo', e.target.value)} error={errors.feeTo} />
                </div>
                <TextField label={tr('بيوصل خلال (اختياري)', 'Arrives within (optional)')} placeholder={tr('خلال يومين', 'Within two days')} value={form.eta} onChange={(e) => set('eta', e.target.value)} maxLength={50} />
                <TextField label={tr('ملاحظة (اختياري)', 'Note (optional)')} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={200} />
              </>
            )}
          </fieldset>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>{s ? tr('احفظ التعديلات', 'Save changes') : tr('ابعت الطلب', 'Send application')}</Button>
            {!s && <Button variant="ghost" onClick={() => setApplying(false)}>{tr('إلغاء', 'Cancel')}</Button>}
          </div>
          {s?.status === 'REJECTED' && <p className="text-sm text-ink-soft">{tr('الحفظ هيبعت الطلب للمراجعة تاني.', 'Saving sends it for review again.')}</p>}
        </form>
      )}
    </PageShell>
  );
}
