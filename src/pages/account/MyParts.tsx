import { useQueryClient } from '@tanstack/react-query';
import { Eye, MessageCircle, MoreVertical, Package, Phone, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { Button, Dialog, EmptyState, ErrorState, errorMessage, Img, PageSpinner, useToast } from '@/components/ui';
import { del, post } from '@/lib/api';
import { formatPrice, relativeDay } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Part } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

const RENEW_AFTER_DAYS = 30;

function PartRowItem({ part, onChanged }: { part: Part; onChanged: () => void }) {
  const { tr, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const old = (Date.now() - new Date(part.listedAt).getTime()) / 86_400_000 >= RENEW_AFTER_DAYS;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast(done);
      onChanged();
    } catch (error) {
      toast(errorMessage(error, tr('محصلش، حاول تاني', "Didn't work, try again")));
    } finally {
      setBusy(false);
      setMenu(false);
      setConfirmDelete(false);
    }
  };

  return (
    <li className="flex gap-4 p-4">
      <Link to={`/parts/${part.id}`} className="shrink-0">
        <Img src={part.images[0]} alt="" className="h-20 w-20 rounded-xl md:h-24 md:w-24" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Link to={`/parts/${part.id}`} className="line-clamp-2 flex-1 font-bold hover:underline">{part.name}</Link>
          <button onClick={() => setMenu(true)} className="rounded-lg p-1 hover:bg-canvas" aria-label={tr('خيارات', 'Options')}>
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
        <p className="font-extrabold">{formatPrice(part.price, lang)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          {part.isSold ? (
            <span className="rounded-md bg-navy-mist px-2 py-0.5 font-bold text-navy">{tr('اتباعت', 'Sold')}</span>
          ) : part.isHidden ? (
            <span className="rounded-md bg-red-50 px-2 py-0.5 font-bold text-red-700">{tr('مخفي من الإدارة', 'Hidden by moderators')}</span>
          ) : (
            <span>{relativeDay(part.listedAt, lang)}</span>
          )}
          {part.stats && (
            <>
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{part.stats.views}</span>
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{part.stats.calls}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{part.stats.whatsapps}</span>
            </>
          )}
        </div>
        {old && !part.isSold && (
          <button disabled={busy} onClick={() => run(() => post(`/parts/${part.id}/renew`), tr('رجع الإعلان لأول القايمة', 'Listing moved back to the top'))} className="mt-2 text-sm font-bold text-orange-deep hover:underline">
            {tr('الإعلان عدّى 30 يوم، جدّده عشان يطلع في الأول', 'Over 30 days old. Renew it to show first again')}
          </button>
        )}
      </div>

      <Dialog open={menu} onClose={() => setMenu(false)} title={part.name}>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => navigate(`/sell/${part.id}`)}>{tr('عدّل', 'Edit')}</Button>
          <Button variant="outline" loading={busy} onClick={() => run(() => post(`/parts/${part.id}/sold`, { sold: !part.isSold }), part.isSold ? tr('رجع للبيع', 'Back on sale') : tr('اتعلّم إنه اتباع', 'Marked as sold'))}>
            {part.isSold ? tr('رجّعه للبيع', 'Put back on sale') : tr('اتباعت', 'Mark as sold')}
          </Button>
          <Button variant="outline" loading={busy} onClick={() => run(() => post(`/parts/${part.id}/renew`), tr('اتجدد الإعلان', 'Listing renewed'))}>
            {tr('جدّد الإعلان', 'Renew listing')}
          </Button>
          <Button variant="ghost" className="text-red-600" onClick={() => { setMenu(false); setConfirmDelete(true); }}>{tr('امسح الإعلان', 'Delete listing')}</Button>
        </div>
      </Dialog>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={tr('تمسح الإعلان؟', 'Delete this listing?')}>
        <p className="mb-5 text-ink-soft">{tr('هيتمسح الإعلان وصوره ومش هيرجع.', 'The listing and its photos will be deleted for good.')}</p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" loading={busy} onClick={() => run(() => del(`/parts/${part.id}`), tr('اتمسح الإعلان', 'Listing deleted'))}>{tr('امسح', 'Delete')}</Button>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>{tr('إلغاء', 'Cancel')}</Button>
        </div>
      </Dialog>
    </li>
  );
}

export default function MyParts() {
  const { tr } = useI18n();
  usePageMeta(tr('إعلاناتي', 'My listings'));
  const queryClient = useQueryClient();
  const list = usePaged<Part>(['me', 'parts'], '/parts/mine');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['me', 'parts'] });

  return (
    <PageShell title={tr('إعلاناتي', 'My listings')}>
      <div className="mb-4 flex justify-end">
        <Link to="/sell"><Button variant="accent" size="sm" tabIndex={-1}><Plus className="h-4 w-4" />{tr('إعلان جديد', 'New listing')}</Button></Link>
      </div>
      {list.isLoading ? (
        <PageSpinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title={tr('معندكش إعلانات', 'No listings yet')} body={tr('اعرض أول قطعة ليك، المشترين هيكلموك على طول.', 'List your first part and buyers will call you directly.')} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            {list.items.map((p) => <PartRowItem key={p.id} part={p} onChanged={refresh} />)}
          </ul>
          <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}
    </PageShell>
  );
}
