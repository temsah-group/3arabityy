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
): Promise<{ sellers: number; parts: number; reports: number }> {
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

  const parts = await Part.insertMany(
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

  // The dashboard: an owner and a moderator, and a few reports to review.
  const { Admin, Report } = container.models;
  await Admin.create([
    { email: 'admin@example.com', fullName: 'مدير عربيتي', role: 'OWNER', passwordHash },
    { email: 'moderator@example.com', fullName: 'مشرف عربيتي', role: 'MODERATOR', passwordHash },
  ]);
  const accounts = [...sellers.values()];
  const reports: object[] = [];
  for (const [index, part] of parts.slice(0, 3).entries()) {
    const reporters = accounts.filter((id) => !id.equals(part.sellerId)).slice(0, 3 - index);
    for (const reporterId of reporters) {
      reports.push({
        reporterId,
        target: 'PART',
        targetId: part._id,
        reason: index === 0 ? 'FAKE' : 'WRONG_INFO',
      });
    }
  }
  const reported = parts[0]!.sellerId;
  reports.push({
    reporterId: accounts.find((id) => !id.equals(reported)),
    target: 'SELLER',
    targetId: reported,
    reason: 'OTHER',
    details: 'بيطلب عربون قبل ما يوريني القطعة',
  });
  await Report.insertMany(reports);

  return { sellers: sellers.size, parts: sampleParts.length, reports: reports.length };
}
