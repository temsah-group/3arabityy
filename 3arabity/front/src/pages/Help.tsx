import { ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { ErrorState, PageSpinner } from '@/components/ui';
import { useAppConfig } from '@/lib/catalog';
import { formatDate, fromE164, whatsappLink } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

/** From `.env`, for when the API sends no support details. */
const DEFAULT_SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? '';

/** `{supportEmail}` in the dashboard's texts stands for the support address. */
const fill = (text: string, email?: string) => text.replaceAll('{supportEmail}', email || DEFAULT_SUPPORT_EMAIL);

export function Help() {
  const { tr, pick } = useI18n();
  usePageMeta(tr('المساعدة', 'Help'));
  const config = useAppConfig();
  if (config.isLoading) return <PageSpinner />;
  if (config.isError || !config.data) return <ErrorState error={config.error} onRetry={() => config.refetch()} />;
  const { faq, support } = config.data;
  const supportEmail = support?.email || DEFAULT_SUPPORT_EMAIL;

  return (
    <PageShell title={tr('المساعدة والأسئلة', 'Help & FAQ')}>
      <div className="space-y-3">
        {faq.sections.map((s, i) => (
          <details key={i} className="group rounded-2xl bg-white ring-1 ring-line open:ring-navy">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-bold">
              {pick(s.titleAr, s.titleEn)}
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="whitespace-pre-line px-5 pb-5 leading-7 text-ink-soft">{fill(pick(s.bodyAr, s.bodyEn), support?.email)}</p>
          </details>
        ))}
      </div>
      {/* The email alone is enough; the phones join it once they are set. */}
      {supportEmail && <section className="mt-8 rounded-2xl bg-navy p-6 text-white">
        <h2 className="text-xl font-extrabold">{tr('عندك مشكلة أو سؤال؟', 'Having a problem or a question?')}</h2>
        <p className="mt-1 text-white/75">
          {tr('ابعتلنا على إيميل الدعم واكتب المشكلة بالتفصيل، وهنرد عليك في أقرب وقت.', "Email our support with the details and we'll get back to you soon.")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 font-bold text-white hover:bg-orange-deep">
            <Mail className="h-5 w-5" />
            <span dir="ltr">{supportEmail}</span>
          </a>
          {support && (
            <>
              <a href={`tel:${support.phone}`} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 font-bold hover:bg-white/20"><Phone className="h-5 w-5" /><span dir="ltr">{fromE164(support.phone)}</span></a>
              <a href={whatsappLink(support.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 font-bold hover:bg-white/20"><MessageCircle className="h-5 w-5" />{tr('واتساب', 'WhatsApp')}</a>
            </>
          )}
        </div>
      </section>}
    </PageShell>
  );
}

export function Legal() {
  const { doc } = useParams();
  const { tr, pick, lang } = useI18n();
  const config = useAppConfig();
  usePageMeta(doc === 'privacy' ? tr('سياسة الخصوصية', 'Privacy policy') : tr('شروط الاستخدام', 'Terms of use'));
  if (config.isLoading) return <PageSpinner />;
  if (config.isError || !config.data) return <ErrorState error={config.error} onRetry={() => config.refetch()} />;
  const isPrivacy = doc === 'privacy';
  const content = isPrivacy ? config.data.privacy : config.data.terms;
  return (
    <PageShell title={isPrivacy ? tr('سياسة الخصوصية', 'Privacy policy') : tr('شروط الاستخدام', 'Terms of use')}>
      {content.updatedAt && <p className="-mt-4 mb-6 text-sm text-ink-soft">{tr('آخر تحديث: ', 'Last updated: ')}{formatDate(content.updatedAt, lang)}</p>}
      <article className="space-y-6 rounded-2xl bg-white p-6 ring-1 ring-line md:p-8">
        {content.sections.map((s, i) => (
          <section key={i}>
            <h2 className="mb-2 text-lg font-extrabold">{pick(s.titleAr, s.titleEn)}</h2>
            <p className="whitespace-pre-line leading-8 text-ink-soft">{fill(pick(s.bodyAr, s.bodyEn), config.data.support?.email)}</p>
          </section>
        ))}
      </article>
    </PageShell>
  );
}
