import { Types } from 'mongoose';

import type { Container } from '../container.js';
import { searchableText, type PartCategory } from '../modules/catalog/catalog.js';
import { hashPassword } from '../modules/users/users.service.js';
import sampleParts from './sample-parts.json' with { type: 'json' };

/** Password of every sample account; development only. */
export const SAMPLE_PASSWORD = 'Password123';

type SamplePart = (typeof sampleParts)[number];

/**
 * Fills an empty database with the app's sample parts (exported from the
 * app's `mock_parts.dart`), one confirmed account per seller:
 * `seller01@example.com` … with [SAMPLE_PASSWORD]. Development only.
 */
export async function seedSampleData(
  container: Container,
): Promise<{ sellers: number; parts: number }> {
  const { User, Part } = container.models;
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);

  const sellers = new Map<string, Types.ObjectId>();
  for (const part of sampleParts as SamplePart[]) {
    if (sellers.has(part.seller.id)) continue;
    const number = part.seller.id.replace(/\D/g, '').padStart(2, '0');
    const user = await User.create({
      fullName: part.seller.name,
      email: `seller${number}@example.com`,
      phone: part.seller.phone,
      passwordHash,
      emailVerifiedAt: new Date(),
      isVerifiedSeller: part.seller.verified,
    });
    sellers.set(part.seller.id, user._id);
  }

  await Part.insertMany(
    (sampleParts as SamplePart[]).map((part) => ({
      sellerId: sellers.get(part.seller.id),
      name: part.name,
      category: part.category,
      condition: part.condition,
      isOriginal: part.isOriginal,
      price: part.price,
      oldPrice: part.oldPrice ?? null,
      partNumber: part.partNumber ?? null,
      description: part.description ?? null,
      images: part.images,
      fitments: part.fitments,
      city: part.city,
      phone: part.phone,
      isFeatured: part.isFeatured,
      isSold: part.isSold,
      listedAt: new Date(part.listedAt),
      searchText: searchableText({
        name: part.name,
        partNumber: part.partNumber,
        category: part.category as PartCategory,
        city: part.city,
        sellerName: part.seller.name,
        fitments: part.fitments,
      }),
    })),
  );
  return { sellers: sellers.size, parts: sampleParts.length };
}
