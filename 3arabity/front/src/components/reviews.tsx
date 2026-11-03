import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useState } from 'react';

import { del, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeDay } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Review, ReviewsPage } from '@/lib/types';

import { Avatar, Button, cx, errorMessage, Stars, Textarea, useToast } from './ui';

export function ReviewItem({ review, context, children }: { review: Review; context?: string; children?: React.ReactNode }) {
  const { lang, tr } = useI18n();
  return (
    <li className="py-4">
      {context && <p className="mb-2 text-xs font-bold text-ink-soft">{context}</p>}
      <div className="flex items-center gap-3">
        <Avatar src={review.author.photoUrl} name={review.author.name} size={36} />
        <div className="flex-1">
          <p className="font-bold">
            {review.author.name}
            {review.mine && <span className="ms-2 text-xs font-semibold text-orange-deep">{tr('تقييمك', 'Your review')}</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <Stars value={review.rating} size={12} />
            {relativeDay(review.createdAt, lang)}
          </div>
        </div>
      </div>
      {review.text && <p className="mt-2 leading-7">{review.text}</p>}
      {review.reply && (
        <div className="ms-6 mt-3 rounded-xl bg-canvas p-3 text-sm">
          <p className="mb-1 font-bold">{tr('رد البياع', "Seller's reply")}</p>
          <p className="leading-6">{review.reply.text}</p>
        </div>
      )}
      {children}
    </li>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { tr } = useI18n();
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={tr('التقييم', 'Rating')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}`} onClick={() => onChange(i)} className="p-0.5">
          <Star className={cx('h-8 w-8', i <= value ? 'fill-orange text-orange' : 'text-line')} />
        </button>
      ))}
    </div>
  );
}

/** Reviews of a part or a shop, with the viewer's own when they may write one. */
export function Reviews({ target, id, ownerId }: { target: 'parts' | 'shops'; id: string; ownerId?: string }) {
  const { tr } = useI18n();
  const { status, user } = useAuth();
  const isOwner = Boolean(user && user.id === ownerId);
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = usePaged<Review, ReviewsPage>(['reviews', target, id, status], `/${target}/${id}/reviews`, {}, { limit: 10 });
  const first = list.first;
  const mine = first?.mine ?? null;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setRating(mine?.rating ?? 0);
    setText(mine?.text ?? '');
    setEditing(true);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviews', target, id] });

  const save = async () => {
    setSaving(true);
    try {
      await put(`/${target}/${id}/reviews/mine`, { rating, text: text.trim() || null });
      setEditing(false);
      toast(tr('اتنشر تقييمك', 'Review published'));
      refresh();
    } catch (e) {
      toast(errorMessage(e, tr('محصلش حفظ', "Couldn't save")));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await del(`/${target}/${id}/reviews/mine`);
      toast(tr('اتمسح تقييمك', 'Review deleted'));
      refresh();
    } catch (e) {
      toast(errorMessage(e, tr('محصلش مسح', "Couldn't delete")));
    }
  };

  const summary = first?.summary;
  const others = list.items.filter((r) => !r.mine);

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
      <h2 className="text-xl font-extrabold">{tr('التقييمات', 'Reviews')}</h2>

      {summary && summary.count > 0 && (
        <div className="mt-4 flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-extrabold">{summary.avg.toFixed(1)}</p>
            <Stars value={summary.avg} />
            <p className="text-xs text-ink-soft">{tr(`${summary.count} تقييم`, `${summary.count} reviews`)}</p>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.breakdown[star - 1] ?? 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{star}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-orange" style={{ width: `${(n / summary.count) * 100}%` }} />
                  </div>
                  <span className="w-6 text-end tabular-nums text-ink-soft">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing ? (
        <div className="mt-5 space-y-3 rounded-xl bg-canvas p-4">
          <StarInput value={rating} onChange={setRating} />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('احكي تجربتك (اختياري)', 'Tell others how it went (optional)')} maxLength={500} />
          <div className="flex gap-2">
            <Button disabled={!rating} loading={saving} onClick={save}>
              {tr('انشر التقييم', 'Publish review')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
          </div>
        </div>
      ) : mine ? (
        <ul>
          <ReviewItem review={mine}>
            <div className="mt-2 flex gap-3 text-sm font-bold">
              <button onClick={startEdit} className="text-orange-deep hover:underline">
                {tr('عدّل', 'Edit')}
              </button>
              <button onClick={remove} className="text-red-600 hover:underline">
                {tr('امسح', 'Delete')}
              </button>
            </div>
          </ReviewItem>
        </ul>
      ) : first?.canReview ? (
        <Button variant="outline" className="mt-4" onClick={startEdit}>
          <Star className="h-4 w-4" />
          {tr('قيّم البياع', 'Write a review')}
        </Button>
      ) : status === 'signedIn' && first && !isOwner ? (
        <p className="mt-3 text-sm text-ink-soft">{tr('تقدر تقيّم بعد ما تكلم البياع.', 'You can review after contacting the seller.')}</p>
      ) : null}

      {list.isLoading ? null : others.length === 0 && !mine ? (
        <p className="mt-4 text-ink-soft">{tr('لسه مفيش تقييمات.', 'No reviews yet.')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {others.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}
      <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
    </section>
  );
}
