import type { ReactNode } from 'react';

import { useI18n } from '@/lib/i18n';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const { tr } = useI18n();
  return (
    <div className="mx-auto grid max-w-5xl gap-0 px-4 py-8 md:grid-cols-2 md:py-14">
      <div className="hidden flex-col justify-end rounded-s-3xl bg-navy p-10 text-white md:flex">
        <img src="/icon.png" alt="" className="mb-auto h-14 w-14 rounded-2xl" />
        <p className="text-3xl font-extrabold leading-snug">{tr('كل قطع غيار عربيتك في مكان واحد.', 'Every part for your car, in one place.')}</p>
        <p className="mt-3 text-white/70">{tr('احفظ القطع، تابع عربياتك، واعرض اللي عندك للبيع.', 'Save parts, follow your cars and sell what you have.')}</p>
      </div>
      <div className="rounded-3xl bg-white p-6 ring-1 ring-line md:rounded-s-none md:p-10">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export const fieldErr = (error: unknown, field: string) =>
  (error as { fieldError?: (f: string) => string | undefined } | null)?.fieldError?.(field);
