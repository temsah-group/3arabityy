import type { ShopSummary } from '../shops/shops.service.js';
import type { PartDocument } from './part.model.js';

/** What the presenter needs of the seller; filled from the users collection. */
export type SellerSummary = {
  id: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  isVerifiedSeller?: boolean | null;
};

/**
 * The part as the app reads it (`SparePart.fromJson`). `stats` only for the
 * part's own seller. [shop] is the seller's shop while buyers may see it.
 */
export function presentPart(
  part: PartDocument,
  seller: SellerSummary | undefined,
  viewerId?: string,
  shop?: ShopSummary,
) {
  const sellerId = part.sellerId.toString();
  return {
    id: part.id as string,
    name: part.name,
    category: part.category,
    condition: part.condition,
    isOriginal: part.isOriginal,
    price: part.price,
    oldPrice: part.oldPrice ?? null,
    partNumber: part.partNumber ?? null,
    description: part.description ?? null,
    images: part.images,
    fitments: part.fitments.map((fitment) => ({
      brandId: fitment.brandId,
      modelId: fitment.modelId,
      fromYear: fitment.fromYear,
      toYear: fitment.toYear,
    })),
    city: part.city,
    isFeatured: part.isFeatured,
    isSold: part.isSold,
    listedAt: part.listedAt,
    rating: { avg: part.rating?.avg ?? 0, count: part.rating?.count ?? 0 },
    shop: shop ?? null,
    seller: {
      id: sellerId,
      name: seller?.fullName ?? '',
      phone: part.phone,
      photoUrl: seller?.profilePhotoUrl ?? null,
      verified: seller?.isVerifiedSeller ?? false,
    },
    ...(viewerId === sellerId
      ? {
          isHidden: part.hiddenAt != null,
          stats: {
            views: part.stats?.views ?? 0,
            calls: part.stats?.calls ?? 0,
            whatsapps: part.stats?.whatsapps ?? 0,
          },
        }
      : {}),
  };
}

export type PublicPart = ReturnType<typeof presentPart>;
