import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

export default function NotFound() {
  const { tr } = useI18n();
  usePageMeta(tr('الصفحة مش موجودة', 'Page not found'));
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-orange">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">{tr('الصفحة دي مش موجودة', "This page doesn't exist")}</h1>
      <Link to="/" className="mt-6 inline-block"><Button tabIndex={-1}>{tr('ارجع للرئيسية', 'Back to home')}</Button></Link>
    </div>
  );
}
