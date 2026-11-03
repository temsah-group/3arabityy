import { Flag, MessageCircle, Phone, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS } from '@/lib/catalog';
import { fromE164, telLink, whatsappLink } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReportReason } from '@/lib/types';

import { Button, cx, Dialog, errorMessage, Field, Textarea, useToast } from './ui';

/**
 * Call and WhatsApp. Each tap is counted first (`contactPath`), which also lets
 * the buyer review the seller later.
 */
export function ContactButtons({
  phone,
  whatsapp,
  contactPath,
  message,
  className,
}: {
  phone: string | null;
  whatsapp?: string | null;
  contactPath?: string;
  message?: string;
  className?: string;
}) {
  const { tr } = useI18n();
  const [revealed, setRevealed] = useState(false);
  if (!phone) return null;
  const count = (channel: 'CALL' | 'WHATSAPP') => {
    if (contactPath) post(contactPath, { channel }).catch(() => {});
  };
  return (
    <div className={cx('flex gap-2', className)}>
      <a
        href={telLink(phone)}
        onClick={() => {
          count('CALL');
          setRevealed(true);
        }}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-navy font-bold text-white hover:bg-navy-deep"
      >
        <Phone className="h-5 w-5" />
        {revealed ? <span dir="ltr">{fromE164(phone)}</span> : tr('اتصل', 'Call')}
      </a>
      <a
        href={whatsappLink(whatsapp ?? phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => count('WHATSAPP')}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1FA855] font-bold text-white hover:bg-[#178A45]"
      >
        <MessageCircle className="h-5 w-5" />
        {tr('واتساب', 'WhatsApp')}
      </a>
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  const { tr } = useI18n();
  const toast = useToast();
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closed by the user.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(tr('اتنسخ اللينك', 'Link copied'));
  };
  return (
    <button onClick={share} className="flex items-center gap-2 rounded-full bg-white p-2 shadow-sm ring-1 ring-line" aria-label={tr('شارك', 'Share')}>
      <Share2 className="h-5 w-5" />
    </button>
  );
}

export function ReportButton({ target, targetId, label }: { target: 'PART' | 'SELLER'; targetId: string; label?: string }) {
  const { tr, lang } = useI18n();
  const { status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const reasons = REPORT_REASONS.filter((r) => r.targets.includes(target));

  const send = async () => {
    if (!reason) return;
    if (reason === 'OTHER' && details.trim().length < 5) {
      setError(tr('اكتب السبب في 5 حروف على الأقل', 'Describe it in at least 5 characters'));
      return;
    }
    setSending(true);
    try {
      await post('/reports', { target, targetId, reason, details: details.trim() || undefined });
      toast(tr('وصلنا البلاغ، هنراجعه', "Report received, we'll review it"));
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e, tr('محصلش إرسال، حاول تاني', "Couldn't send, try again")));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => (status === 'signedIn' ? setOpen(true) : navigate('/login', { state: { from: window.location.pathname } }))}
        className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-red-600"
      >
        <Flag className="h-4 w-4" />
        {label ?? (target === 'PART' ? tr('بلّغ عن الإعلان', 'Report this listing') : tr('بلّغ عن البياع', 'Report this seller'))}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tr('بلاغ', 'Report')}>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-ink-soft">{tr('إيه المشكلة؟', "What's wrong?")}</legend>
          {reasons.map((r) => (
            <label key={r.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3', reason === r.id ? 'border-navy bg-navy-mist' : 'border-line')}>
              <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-navy" />
              <span className="font-semibold">{lang === 'ar' ? r.ar : r.en}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-4">
          <Field label={reason === 'OTHER' ? tr('التفاصيل', 'Details') : tr('تفاصيل (اختياري)', 'Details (optional)')} error={error}>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
          </Field>
        </div>
        <Button className="mt-5 w-full" disabled={!reason} loading={sending} onClick={send}>
          {tr('ابعت البلاغ', 'Send report')}
        </Button>
      </Dialog>
    </>
  );
}

