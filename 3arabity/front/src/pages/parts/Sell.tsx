import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BrandSelect } from '@/components/cars';
import { Button, cx, Dialog, ErrorState, Field, Img, PageSpinner, Select, Textarea, TextField, useToast } from '@/components/ui';
import { ApiError, get, patch, post, upload } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, GOVERNORATES, modelYears, useLabels } from '@/lib/catalog';
import { formatPrice, fromE164, toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Category, Condition, Fitment, Part, PartInput } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

const MAX_PHOTOS = 8;

interface Draft {
  name: string;
  category: Category | '';
  condition: Condition | '';
  isOriginal: boolean;
  partNumber: string;
  description: string;
  fitments: Fitment[];
  images: string[];
  price: string;
  oldPrice: string;
  city: string;
  phone: string;
}

const emptyDraft = (phone: string): Draft => ({
  name: '',
  category: '',
  condition: '',
  isOriginal: true,
  partNumber: '',
  description: '',
  fitments: [],
  images: [],
  price: '',
  oldPrice: '',
  city: '',
  phone: fromE164(phone),
});

const fromPart = (p: Part): Draft => ({
  name: p.name,
  category: p.category,
  condition: p.condition,
  isOriginal: p.isOriginal,
  partNumber: p.partNumber ?? '',
  description: p.description ?? '',
  fitments: p.fitments,
  images: p.images,
  price: String(p.price),
  oldPrice: p.oldPrice ? String(p.oldPrice) : '',
  city: p.city,
  phone: fromE164(p.seller.phone),
});

function Choice<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T | ''; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx('rounded-xl px-4 py-2.5 text-sm font-bold ring-1 transition-colors', value === o.id ? 'bg-navy text-white ring-navy' : 'bg-white ring-line hover:ring-navy')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FitmentDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (f: Fitment) => void }) {
  const { tr, pick } = useI18n();
  const { brands } = useLabels();
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const brand = brands.find((b) => b.id === brandId);
  const model = brand?.models.find((m) => m.id === modelId);
  const years = useMemo(() => {
    if (!model) return [];
    const [first, last] = modelYears(model);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [model]);

  useEffect(() => {
    if (years.length) {
      setFrom(String(years[0]));
      setTo(String(years[years.length - 1]));
    }
  }, [years]);

  const reset = () => {
    setBrandId('');
    setModelId('');
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} title={tr('بتركب على أنهي عربية؟', 'Which car does it fit?')}>
      <div className="space-y-4">
        <Field label={tr('الماركة', 'Make')}>
          <BrandSelect brands={brands} value={brandId} onChange={(id) => { setBrandId(id); setModelId(''); }} placeholder={tr('اختار', 'Choose')} ariaLabel={tr('الماركة', 'Make')} />
        </Field>
        {brand && (
          <Field label={tr('الموديل', 'Model')}>
            <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">{tr('اختار', 'Choose')}</option>
              {brand.models.map((m) => <option key={m.id} value={m.id}>{pick(m.nameAr, m.nameEn)}</option>)}
            </Select>
          </Field>
        )}
        {model && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('من سنة', 'From')}>
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
            <Field label={tr('لحد سنة', 'To')}>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                {years.filter((y) => y >= Number(from)).map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
          </div>
        )}
        <Button
          className="w-full"
          disabled={!model || !from || !to}
          onClick={() => {
            onAdd({ brandId, modelId, fromYear: Number(from), toYear: Math.max(Number(from), Number(to)) });
            reset();
            onClose();
          }}
        >
          {tr('ضيف', 'Add')}
        </Button>
      </div>
    </Dialog>
  );
}

function Photos({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const { tr } = useI18n();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  // Keep the latest list while several uploads finish.
  const latest = useRef(images);
  latest.current = images;

  const pickFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast(tr(`أقصى عدد ${MAX_PHOTOS} صور`, `Up to ${MAX_PHOTOS} photos`));
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const { path } = await upload<{ path: string }>('/uploads/parts', file);
        latest.current = [...latest.current, path];
        onChange(latest.current);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : tr('الصورة مترفعتش', "The photo didn't upload"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-xl bg-navy-mist">
            <Img src={src} alt="" className="h-full w-full" />
            {i === 0 ? (
              <span className="absolute start-1.5 top-1.5 rounded-md bg-orange px-1.5 text-xs font-bold text-white">{tr('الغلاف', 'Cover')}</span>
            ) : (
              <button type="button" onClick={() => onChange([src, ...images.filter((x) => x !== src)])} className="absolute start-1.5 top-1.5 rounded-md bg-white/90 p-1" aria-label={tr('خليها الغلاف', 'Make cover')}>
                <Star className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => onChange(images.filter((x) => x !== src))} className="absolute end-1.5 top-1.5 rounded-md bg-white/90 p-1 text-red-600" aria-label={tr('امسح', 'Remove')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-xl bg-navy-mist">
            <Loader2 className="h-6 w-6 animate-spin text-navy" />
          </div>
        ))}
        {images.length + uploading < MAX_PHOTOS && (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm font-bold text-ink-soft hover:border-navy hover:text-navy">
            <ImagePlus className="h-7 w-7" />
            {tr('ضيف صور', 'Add photos')}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { void pickFiles(e.target.files); e.target.value = ''; }} />
      <p className="mt-3 text-sm text-ink-soft">{tr('لحد 8 صور، JPG أو PNG أو WebP، كل صورة أقل من 8 ميجا. الصورة الأولى هي اللي بتظهر في البحث.', 'Up to 8 photos (JPG, PNG or WebP, under 8 MB each). The first one shows in search.')}</p>
    </div>
  );
}

export default function Sell() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { tr, lang } = useI18n();
  usePageMeta(editing ? tr('تعديل الإعلان', 'Edit listing') : tr('بيع قطعة', 'Sell a part'));
  const labels = useLabels();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existing = useQuery({ queryKey: ['part', id], queryFn: () => get<Part>(`/parts/${id}`), enabled: editing });
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(user?.phone ?? ''));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fitmentOpen, setFitmentOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (existing.data) setDraft(fromPart(existing.data));
  }, [existing.data]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const steps = [tr('القطعة', 'Part'), tr('العربيات', 'Cars'), tr('الصور', 'Photos'), tr('السعر', 'Price'), tr('المراجعة', 'Review')];

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      const n = draft.name.trim().length;
      if (n < 3 || n > 100) e.name = tr('الاسم من 3 لـ 100 حرف', 'Name must be 3–100 characters');
      if (!draft.category) e.category = tr('اختار القسم', 'Choose a category');
      if (!draft.condition) e.condition = tr('اختار الحالة', 'Choose a condition');
    }
    if (s === 1 && !draft.fitments.length) e.fitments = tr('ضيف عربية واحدة على الأقل', 'Add at least one car');
    if (s === 2 && !draft.images.length) e.images = tr('ضيف صورة واحدة على الأقل', 'Add at least one photo');
    if (s === 3) {
      const price = Number(draft.price);
      if (!Number.isInteger(price) || price < 1 || price > 10_000_000) e.price = tr('اكتب سعر صحيح بالجنيه', 'Enter a valid price in pounds');
      if (draft.oldPrice && !(Number(draft.oldPrice) > price)) e.oldPrice = tr('السعر القديم لازم يكون أكبر من الجديد', 'The old price must be higher');
      if (!draft.city) e.city = tr('اختار المحافظة', 'Choose a governorate');
      if (!toE164(draft.phone)) e.phone = tr('اكتب رقم موبايل مصري صحيح', 'Enter an Egyptian mobile number');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publish = async () => {
    for (let s = 0; s < 4; s++) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    const body: PartInput = {
      name: draft.name.trim(),
      category: draft.category as Category,
      condition: draft.condition as Condition,
      isOriginal: draft.isOriginal,
      price: Number(draft.price),
      oldPrice: draft.oldPrice ? Number(draft.oldPrice) : null,
      partNumber: draft.partNumber.trim() || null,
      description: draft.description.trim() || null,
      images: draft.images,
      fitments: draft.fitments,
      city: draft.city,
      phone: toE164(draft.phone)!,
    };
    setPublishing(true);
    try {
      const part = editing ? await patch<Part>(`/parts/${id}`, body) : await post<Part>('/parts', body);
      queryClient.invalidateQueries({ queryKey: ['part', part.id] });
      queryClient.invalidateQueries({ queryKey: ['me', 'parts'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      toast(editing ? tr('اتحفظت التعديلات', 'Changes saved') : tr('اتنشر إعلانك', 'Your listing is live'));
      navigate(`/parts/${part.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.errors.length) {
        const map: Record<string, string> = {};
        error.errors.forEach((x) => (map[x.field.split('.')[0]] = x.message));
        setErrors(map);
        const fieldStep: Record<string, number> = { name: 0, category: 0, condition: 0, partNumber: 0, description: 0, fitments: 1, images: 2 };
        setStep(Math.min(...error.errors.map((x) => fieldStep[x.field.split('.')[0]] ?? 3)));
      }
      toast(error instanceof ApiError ? error.message : tr('محصلش نشر، حاول تاني', "Couldn't publish, try again"));
    } finally {
      setPublishing(false);
    }
  };

  if (editing && existing.isLoading) return <PageSpinner />;
  if (editing && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">{editing ? tr('عدّل الإعلان', 'Edit listing') : tr('بيع قطعة', 'Sell a part')}</h1>

      <ol className="mt-6 flex gap-1.5" aria-label={tr('الخطوات', 'Steps')}>
        {steps.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className="w-full text-start disabled:cursor-default"
            >
              <span className={cx('block h-1.5 rounded-full', i <= step ? 'bg-orange' : 'bg-line')} />
              <span className={cx('mt-1.5 hidden text-xs font-bold sm:block', i === step ? 'text-navy' : 'text-ink-muted')}>{i + 1}. {label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
        {step === 0 && (
          <div className="space-y-5">
            <TextField label={tr('اسم القطعة', 'Part name')} placeholder={tr('مثلاً: طقم تيل فرامل أمامي', 'e.g. Front brake pad set')} value={draft.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={100} />
            <Field label={tr('القسم', 'Category')} error={errors.category}>
              <Choice options={CATEGORIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} value={draft.category} onChange={(v) => set('category', v)} />
            </Field>
            <Field label={tr('الحالة', 'Condition')} error={errors.condition}>
              <Choice options={CONDITIONS.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} value={draft.condition} onChange={(v) => set('condition', v)} />
            </Field>
            <Field label={tr('أصلي ولا تجاري؟', 'Original or aftermarket?')}>
              <Choice options={[{ id: 'y', label: tr('أصلي', 'Original') }, { id: 'n', label: tr('تجاري', 'Aftermarket') }]} value={draft.isOriginal ? 'y' : 'n'} onChange={(v) => set('isOriginal', v === 'y')} />
            </Field>
            <TextField label={tr('رقم القطعة (اختياري)', 'Part number (optional)')} dir="ltr" value={draft.partNumber} onChange={(e) => set('partNumber', e.target.value)} maxLength={40} error={errors.partNumber} />
            <Field label={tr('الوصف (اختياري)', 'Description (optional)')} error={errors.description} hint={`${draft.description.length}/1000`}>
              <Textarea value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} placeholder={tr('حالتها، فيها ضمان ولا لأ، أي حاجة المشتري محتاج يعرفها', 'Its state, any warranty, anything a buyer should know')} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-4 text-ink-soft">{tr('ضيف كل العربيات اللي القطعة بتركب عليها، عشان توصل لأصحابها.', 'Add every car it fits so their owners find it.')}</p>
            <ul className="space-y-2">
              {draft.fitments.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                  <span className="font-bold">{labels.brand(f.brandId)} {labels.model(f.brandId, f.modelId)} <span className="font-normal text-ink-soft" dir="ltr">{f.fromYear}–{f.toYear}</span></span>
                  <button type="button" onClick={() => set('fitments', draft.fitments.filter((_, j) => j !== i))} className="text-red-600" aria-label={tr('امسح', 'Remove')}>
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
            {draft.fitments.length < 20 && (
              <Button variant="outline" className="mt-3" onClick={() => setFitmentOpen(true)}>
                <Plus className="h-4 w-4" />
                {tr('ضيف عربية', 'Add a car')}
              </Button>
            )}
            {errors.fitments && <p className="mt-2 text-sm text-red-600">{errors.fitments}</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <Photos images={draft.images} onChange={(images) => set('images', images)} />
            {errors.images && <p className="mt-2 text-sm text-red-600">{errors.images}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={tr('السعر بالجنيه', 'Price (EGP)')} type="number" inputMode="numeric" min={1} value={draft.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
              <TextField label={tr('السعر قبل الخصم (اختياري)', 'Price before discount (optional)')} type="number" inputMode="numeric" min={1} value={draft.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} error={errors.oldPrice} />
            </div>
            <Field label={tr('المحافظة', 'Governorate')} error={errors.city}>
              <Select value={draft.city} onChange={(e) => set('city', e.target.value)}>
                <option value="">{tr('اختار', 'Choose')}</option>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{labels.city(g)}</option>)}
              </Select>
            </Field>
            <TextField label={tr('رقم التواصل', 'Contact number')} type="tel" dir="ltr" value={draft.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint={tr('المشترين هيكلموك عليه أو على واتساب.', 'Buyers call or WhatsApp you on it.')} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Img src={draft.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-xl" />
              <div>
                <p className="text-lg font-extrabold">{draft.name}</p>
                <p className="text-sm text-ink-soft">
                  {draft.category && labels.category(draft.category)} · {draft.condition && labels.condition(draft.condition)} · {draft.isOriginal ? tr('أصلي', 'Original') : tr('تجاري', 'Aftermarket')}
                </p>
                <p className="mt-1 text-xl font-extrabold">{draft.price && formatPrice(Number(draft.price), lang)}</p>
              </div>
            </div>
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between py-2.5"><dt className="text-ink-soft">{tr('العربيات', 'Cars')}</dt><dd className="text-end font-bold">{draft.fitments.map((f) => `${labels.model(f.brandId, f.modelId)} ${f.fromYear}–${f.toYear}`).join('، ')}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-soft">{tr('الصور', 'Photos')}</dt><dd className="font-bold">{draft.images.length}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-soft">{tr('المحافظة', 'Governorate')}</dt><dd className="font-bold">{labels.city(draft.city)}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-soft">{tr('رقم التواصل', 'Contact number')}</dt><dd className="font-bold" dir="ltr">{draft.phone}</dd></div>
            </dl>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            {tr('رجوع', 'Back')}
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button className="flex-1" onClick={next}>
            {tr('التالي', 'Next')}
          </Button>
        ) : (
          <Button variant="accent" className="flex-1" loading={publishing} onClick={publish}>
            <Check className="h-5 w-5" />
            {editing ? tr('احفظ التعديلات', 'Save changes') : tr('انشر الإعلان', 'Publish listing')}
          </Button>
        )}
      </div>

      <FitmentDialog open={fitmentOpen} onClose={() => setFitmentOpen(false)} onAdd={(f) => set('fitments', [...draft.fitments, f])} />
    </div>
  );
}
