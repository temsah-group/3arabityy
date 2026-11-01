import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useState } from 'react';

import { PageShell } from '@/components/Layout';
import { ReviewItem } from '@/components/reviews';
import { Button, EmptyState, ErrorState, errorMessage, PageSpinner, Textarea, useToast } from '@/components/ui';
import { put } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Review } from '@/lib/types';

function Reply({ review, onDone }: { review: Review; onDone: () => void }) {
  const { tr } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? '');
  const [busy, setBusy] = useState(false);
  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await put(`/reviews/${review.id}/reply`, { text: value });
      setOpen(false);
      onDone();
    } catch (e) {
      toast(errorMessage(e, tr('محصلش حفظ', "Couldn't save")));
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <div className="mt-2 flex gap-3 text-sm font-bold">
        <button onClick={() => setOpen(true)} className="text-orange-deep hover:underline">{review.reply ? tr('عدّل الرد', 'Edit reply') : tr('رُد', 'Reply')}</button>
        {review.reply && <button onClick={() => save(null)} className="text-red-600 hover:underline">{tr('امسح الرد', 'Delete reply')}</button>}
      </div>
    );
  return (
    <div className="mt-3 space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoFocus />
      <div className="flex gap-2">
        <Button size="sm" loading={busy} disabled={!text.trim()} onClick={() => save(text.trim())}>{tr('انشر الرد', 'Post reply')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
      </div>
    </div>
  );
}

export default function ReceivedReviews() {
  const { tr } = useI18n();
  const queryClient = useQueryClient();
  const list = usePaged<Review>(['me', 'reviews'], '/reviews/received');
  return (
    <PageShell title={tr('التقييمات اللي وصلتني', 'Reviews I received')}>
      {list.isLoading ? (
        <PageSpinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={<Star className="h-10 w-10" />} title={tr('لسه محدش قيّمك', 'No reviews yet')} body={tr('المشترين يقدروا يقيّموك بعد ما يكلموك.', 'Buyers can review you after contacting you.')} />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl bg-white px-5 ring-1 ring-line">
            {list.items.map((r) => (
              <ReviewItem key={r.id} review={r} context={r.targetName}>
                <Reply review={r} onDone={() => queryClient.invalidateQueries({ queryKey: ['me', 'reviews'] })} />
              </ReviewItem>
            ))}
          </ul>
          <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}
    </PageShell>
  );
}
