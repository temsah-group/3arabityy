import { randomBytes } from 'node:crypto';

import mongoose, { type Types } from 'mongoose';

import { loadEnv } from '../config/env.js';
import { createContainer } from '../container.js';
import sampleParts from '../dev/sample-parts.json' with { type: 'json' };
import { searchableText, type PartCategory } from '../modules/catalog/catalog.js';
import { RATING_PRIOR } from '../modules/shops/shop.model.js';
import { hashPassword } from '../modules/users/users.service.js';

/**
 * `npm run seed:demo`: fills the database in `.env` with sellers, shops,
 * parts and reviews to show the app with. Every account it makes has an
 * address at [DEMO_DOMAIN]; running it again first removes those accounts
 * and everything they made, and touches nothing else. The accounts get a
 * random password nobody knows: they are there to be looked at.
 *
 *   npm run seed:demo            # replace the demo data
 *   npm run seed:demo -- --remove  # only remove it
 */
const DEMO_DOMAIN = 'demo.3arabity.app';

type Fitment = { brandId: string; modelId: string; fromYear: number; toYear: number };
type DemoPart = {
  seller: string;
  name: string;
  category: PartCategory;
  condition: 'NEW' | 'USED' | 'IMPORTED';
  isOriginal: boolean;
  price: number;
  oldPrice?: number;
  partNumber?: string;
  description: string;
  images: string[];
  fitments: Fitment[];
  isFeatured?: boolean;
  daysAgo: number;
};

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=70&auto=format&fit=crop`;
const PHOTOS: Record<PartCategory, string[]> = {
  BRAKES: [photo('1696494561430-de087dd0bd69'), photo('1760317890322-364a810cd4da')],
  LIGHTS: [photo('1556448851-9359658faa54'), photo('1542282088-fe8426682b8f')],
  SUSPENSION: [photo('1760836395716-7dd00b71311a')],
  ENGINE: [
    photo('1486262715619-67b85e0b08d3'),
    photo('1527383418406-f85a3b146499'),
    photo('1614447428943-52ec0bdbc7aa'),
    photo('1584741621183-bb35de119593'),
  ],
  BODY: [photo('1539799139339-50c5fe1e2b1b'), photo('1710079230507-f07eadefabb5')],
  FILTERS: [photo('1777118947168-b6e806cb80cf')],
  ELECTRICAL: [photo('1757547570448-04946db22218'), photo('1676337167752-2062c6ca7366')],
  TYRES: [photo('1571335746824-742511d49bce'), photo('1444947295498-07f60c19a4ff')],
};
const fit = (brandId: string, modelId: string, fromYear: number, toYear = 2026): Fitment => ({
  brandId,
  modelId,
  fromYear,
  toYear,
});

type Seller = { key: string; name: string; phone: string; city: string; verified: boolean };

/** The sample sellers, keyed as in `sample-parts.json`. */
const SELLERS: Seller[] = [
  ...new Map(
    sampleParts.map((part) => [
      part.seller.id,
      {
        key: part.seller.id,
        name: part.seller.name,
        phone: part.seller.phone,
        city: part.city,
        verified: part.seller.verified,
      },
    ]),
  ).values(),
];

type DemoShop = {
  seller: string;
  status: 'APPROVED' | 'PENDING';
  description: string;
  address: string;
  hours: string;
  brandIds: string[];
  categories: PartCategory[];
  delivery: {
    available: boolean;
    governorates?: string[];
    feeFrom?: number;
    feeTo?: number;
    eta?: string;
    note?: string;
  };
  isVerified?: boolean;
  isFeatured?: boolean;
  logo: string;
  cover: string;
};

const SHOPS: DemoShop[] = [
  {
    seller: 'seller-01',
    status: 'APPROVED',
    description:
      'محل قطع غيار تويوتا وهيونداي من 1998. أصلي وتجاري بضمان، وبنركّب في ورشتنا لو حابب.',
    address: 'شارع التوفيقية، وسط البلد، القاهرة',
    hours: 'يومياً من 10ص لـ 10م، الجمعة بعد الصلاة',
    brandIds: ['toyota', 'hyundai'],
    categories: ['BRAKES', 'ENGINE', 'FILTERS', 'SUSPENSION'],
    delivery: {
      available: true,
      governorates: ['القاهرة', 'الجيزة', 'القليوبية'],
      feeFrom: 50,
      feeTo: 100,
      eta: 'في نفس اليوم',
    },
    isVerified: true,
    isFeatured: true,
    logo: PHOTOS.BRAKES[0]!,
    cover: PHOTOS.ENGINE[0]!,
  },
  {
    seller: 'seller-02',
    status: 'APPROVED',
    description: 'استيراد من الخليج: فوانيس ومرايات وكماليات، كل القطع مفحوصة قبل البيع.',
    address: 'شارع فيصل، الطالبية، الجيزة',
    hours: 'من السبت للخميس 11ص - 11م',
    brandIds: ['toyota', 'nissan', 'kia'],
    categories: ['LIGHTS', 'BODY', 'ELECTRICAL'],
    delivery: {
      available: true,
      governorates: ['الجيزة', 'القاهرة', 'الإسكندرية', 'الدقهلية', 'الغربية'],
      feeFrom: 80,
      feeTo: 150,
      eta: 'من يوم لـ 3 أيام',
      note: 'الشحن للمحافظات عن طريق شركة شحن والدفع عند الاستلام',
    },
    isVerified: true,
    isFeatured: true,
    logo: PHOTOS.LIGHTS[0]!,
    cover: PHOTOS.LIGHTS[1]!,
  },
  {
    seller: 'seller-04',
    status: 'APPROVED',
    description: 'متخصصين في موتورات وفتيس العربيات الياباني، مستورد بحالة الزيرو.',
    address: 'شارع شبرا الرئيسي، شبرا، القاهرة',
    hours: 'يومياً 9ص - 9م',
    brandIds: ['toyota', 'nissan', 'mitsubishi'],
    categories: ['ENGINE', 'ELECTRICAL'],
    delivery: { available: false },
    isVerified: true,
    logo: PHOTOS.ENGINE[1]!,
    cover: PHOTOS.ENGINE[2]!,
  },
  {
    seller: 'seller-07',
    status: 'APPROVED',
    description: 'كهرباء سيارات: دينامو، مارش، حساسات وكمبيوتر. فحص مجاني قبل الشراء.',
    address: 'شارع البحر، طنطا، الغربية',
    hours: 'من السبت للخميس 10ص - 8م',
    brandIds: ['hyundai', 'kia', 'chevrolet'],
    categories: ['ELECTRICAL', 'LIGHTS'],
    delivery: {
      available: true,
      governorates: ['الغربية', 'المنوفية', 'كفر الشيخ'],
      feeFrom: 40,
      feeTo: 70,
      eta: 'خلال يومين',
    },
    logo: PHOTOS.ELECTRICAL[0]!,
    cover: PHOTOS.ELECTRICAL[1]!,
  },
  {
    seller: 'seller-11',
    status: 'APPROVED',
    description: 'بطاريات وكاوتش بالضمان، وبنركّب البطارية عندك في البيت.',
    address: 'مدينة نصر، الحي السابع، القاهرة',
    hours: 'يومياً 9ص - 12م',
    brandIds: [],
    categories: ['ELECTRICAL', 'TYRES'],
    delivery: {
      available: true,
      governorates: ['القاهرة', 'الجيزة'],
      feeFrom: 0,
      feeTo: 50,
      eta: 'خلال ساعتين',
      note: 'التوصيل مجاني جوه مدينة نصر',
    },
    logo: PHOTOS.ELECTRICAL[1]!,
    cover: PHOTOS.TYRES[0]!,
  },
  {
    // Waiting for the dashboard, to show approving one.
    seller: 'seller-03',
    status: 'PENDING',
    description: 'عفشة ودبرياج لكل العربيات الكوري، أصلي وتجاري.',
    address: 'شارع خالد بن الوليد، سيدي بشر، الإسكندرية',
    hours: 'من السبت للخميس 10ص - 9م',
    brandIds: ['hyundai', 'kia'],
    categories: ['SUSPENSION', 'BRAKES'],
    delivery: { available: true, governorates: ['الإسكندرية', 'البحيرة'], feeFrom: 60 },
    logo: PHOTOS.SUSPENSION[0]!,
    cover: PHOTOS.BRAKES[1]!,
  },
];

/** More parts, on top of the sample ones, so every shop has a few. */
const EXTRA_PARTS: DemoPart[] = [
  {
    seller: 'seller-01',
    name: 'فلتر زيت تويوتا أصلي',
    category: 'FILTERS',
    condition: 'NEW',
    isOriginal: true,
    price: 220,
    oldPrice: 260,
    partNumber: '90915-YZZD4',
    description: 'فلتر زيت أصلي في العلبة، بيركب على كورولا وياريس.',
    images: PHOTOS.FILTERS,
    fitments: [fit('toyota', 'corolla', 2008), fit('toyota', 'yaris', 2010)],
    daysAgo: 1,
  },
  {
    seller: 'seller-01',
    name: 'طقم مساعدين أمامي هيونداي',
    category: 'SUSPENSION',
    condition: 'NEW',
    isOriginal: false,
    price: 3200,
    description: 'مساعدين كوري تجاري درجة أولى، ضمان سنة.',
    images: PHOTOS.SUSPENSION,
    fitments: [fit('hyundai', 'elantra', 2016), fit('hyundai', 'accent', 2012)],
    isFeatured: true,
    daysAgo: 2,
  },
  {
    seller: 'seller-01',
    name: 'طنابير فرامل خلفي كورولا',
    category: 'BRAKES',
    condition: 'NEW',
    isOriginal: true,
    price: 1900,
    description: 'جوز طنابير أصلي، معاه التيل.',
    images: PHOTOS.BRAKES.slice(1),
    fitments: [fit('toyota', 'corolla', 2014)],
    daysAgo: 6,
  },
  {
    seller: 'seller-02',
    name: 'مراية جانبية شمال بالإشارة',
    category: 'BODY',
    condition: 'IMPORTED',
    isOriginal: true,
    price: 2600,
    oldPrice: 3000,
    description: 'مراية كهربا بالإشارة والتسخين، استيراد بحالة الجديد.',
    images: PHOTOS.BODY,
    fitments: [fit('nissan', 'sunny', 2014), fit('nissan', 'qashqai', 2015)],
    isFeatured: true,
    daysAgo: 1,
  },
  {
    seller: 'seller-02',
    name: 'فانوس خلفي شمال سبورتاج',
    category: 'LIGHTS',
    condition: 'IMPORTED',
    isOriginal: true,
    price: 3900,
    description: 'فانوس LED استيراد، مفيهوش أي شرخ.',
    images: PHOTOS.LIGHTS.slice(1),
    fitments: [fit('kia', 'sportage', 2017)],
    daysAgo: 3,
  },
  {
    seller: 'seller-02',
    name: 'كشاف ضباب أمامي كامري',
    category: 'LIGHTS',
    condition: 'USED',
    isOriginal: true,
    price: 950,
    description: 'جوز كشافات ضباب أصلي، شغالين كويس.',
    images: PHOTOS.LIGHTS,
    fitments: [fit('toyota', 'corolla', 2017), fit('toyota', 'fortuner', 2016)],
    daysAgo: 8,
  },
  {
    seller: 'seller-04',
    name: 'موتور كامل لانسر 1600',
    category: 'ENGINE',
    condition: 'IMPORTED',
    isOriginal: true,
    price: 42000,
    oldPrice: 46000,
    description: 'موتور مستورد من اليابان، مشي 60 ألف كيلو، بالضمان على الكرنك.',
    images: PHOTOS.ENGINE.slice(2),
    fitments: [fit('mitsubishi', 'lancer', 2008, 2017)],
    isFeatured: true,
    daysAgo: 2,
  },
  {
    seller: 'seller-04',
    name: 'طقم كاتينة صني',
    category: 'ENGINE',
    condition: 'NEW',
    isOriginal: true,
    price: 4300,
    partNumber: '13028-ED000',
    description: 'طقم كاتينة كامل أصلي نيسان.',
    images: PHOTOS.ENGINE.slice(3),
    fitments: [fit('nissan', 'sunny', 2012)],
    daysAgo: 4,
  },
  {
    seller: 'seller-04',
    name: 'دينامو ياريس',
    category: 'ELECTRICAL',
    condition: 'IMPORTED',
    isOriginal: true,
    price: 2800,
    description: 'دينامو ياباني مستورد، متجرّب قدامك.',
    images: PHOTOS.ELECTRICAL,
    fitments: [fit('toyota', 'yaris', 2010)],
    daysAgo: 9,
  },
  {
    seller: 'seller-07',
    name: 'مارش إلنترا',
    category: 'ELECTRICAL',
    condition: 'USED',
    isOriginal: true,
    price: 1500,
    description: 'مارش أصلي مستعمل بحالة ممتازة، ضمان شهر.',
    images: PHOTOS.ELECTRICAL.slice(1),
    fitments: [fit('hyundai', 'elantra', 2011)],
    daysAgo: 2,
  },
  {
    seller: 'seller-07',
    name: 'حساس أكسجين سيراتو',
    category: 'ELECTRICAL',
    condition: 'NEW',
    isOriginal: false,
    price: 850,
    description: 'حساس تجاري درجة أولى، بيركب على سيراتو وإلنترا.',
    images: PHOTOS.ELECTRICAL,
    fitments: [fit('kia', 'cerato', 2013), fit('hyundai', 'elantra', 2013)],
    daysAgo: 5,
  },
  {
    seller: 'seller-07',
    name: 'فانوس أمامي أوبترا',
    category: 'LIGHTS',
    condition: 'NEW',
    isOriginal: false,
    price: 1100,
    description: 'فانوس تجاري تايواني، الجوز بـ 2100.',
    images: PHOTOS.LIGHTS,
    fitments: [fit('chevrolet', 'optra', 2008)],
    daysAgo: 7,
  },
  {
    seller: 'seller-11',
    name: 'بطارية 70 أمبير',
    category: 'ELECTRICAL',
    condition: 'NEW',
    isOriginal: false,
    price: 4200,
    oldPrice: 4600,
    description: 'بطارية كورية ضمان سنة ونص، بنركّبها عندك.',
    images: PHOTOS.ELECTRICAL.slice(1),
    fitments: [
      fit('hyundai', 'elantra', 2008),
      fit('kia', 'cerato', 2010),
      fit('toyota', 'corolla', 2008),
    ],
    isFeatured: true,
    daysAgo: 1,
  },
  {
    seller: 'seller-11',
    name: 'كاوتش 205/55 R16 (4 فردات)',
    category: 'TYRES',
    condition: 'NEW',
    isOriginal: false,
    price: 12800,
    description: 'إنتاج السنة دي، السعر للأربع فردات بالترصيص.',
    images: PHOTOS.TYRES,
    fitments: [fit('toyota', 'corolla', 2014), fit('hyundai', 'elantra', 2016)],
    daysAgo: 3,
  },
  {
    seller: 'seller-05',
    name: 'كبوت لانوس',
    category: 'BODY',
    condition: 'USED',
    isOriginal: true,
    price: 1800,
    description: 'كبوت أصلي من تشليح، محتاج دهان بس.',
    images: PHOTOS.BODY.slice(1),
    fitments: [fit('chevrolet', 'lanos', 2008, 2015)],
    daysAgo: 4,
  },
  {
    seller: 'seller-06',
    name: 'زيت موتور 5W-30 (4 لتر)',
    category: 'FILTERS',
    condition: 'NEW',
    isOriginal: false,
    price: 1350,
    description: 'زيت فول سينثتك، ومعاه فلتر هدية.',
    images: PHOTOS.FILTERS,
    fitments: [fit('kia', 'picanto', 2011), fit('hyundai', 'accent', 2011)],
    daysAgo: 2,
  },
  {
    seller: 'seller-09',
    name: 'رادياتير توسان',
    category: 'ENGINE',
    condition: 'IMPORTED',
    isOriginal: true,
    price: 3600,
    description: 'رادياتير كوري مستورد، متجرّب ضغط.',
    images: PHOTOS.ENGINE.slice(1),
    fitments: [fit('hyundai', 'tucson', 2016)],
    daysAgo: 6,
  },
];

const BUYERS = [
  { name: 'أحمد سمير', phone: '+201112345601' },
  { name: 'محمود عادل', phone: '+201112345602' },
  { name: 'كريم حسن', phone: '+201112345603' },
  { name: 'مصطفى إبراهيم', phone: '+201112345604' },
  { name: 'يوسف طارق', phone: '+201112345605' },
  { name: 'عمر خالد', phone: '+201112345606' },
];

/** [stars, words, the shop's answer] by buyer, per shop. */
const SHOP_REVIEWS: Record<string, [number, string | null, string | null][]> = {
  'seller-01': [
    [
      5,
      'محل محترم والقطعة أصلي زي ما قال بالظبط، ووصلتني في نفس اليوم.',
      'نورتنا يا باشا، في أي وقت',
    ],
    [5, 'أسعارهم كويسة جداً مقارنة بالتوفيقية.', null],
    [4, 'كله تمام بس الرد على الواتساب اتأخر شوية.', 'معلش يا فندم، كان يوم زحمة'],
    [5, null, null],
    [5, 'تاني مرة أتعامل معاهم ومفيش أي مشكلة.', null],
  ],
  'seller-02': [
    [5, 'الفانوس جالي بحالة الجديد بالظبط، والشحن لإسكندرية كان سريع.', 'شكراً لحضرتك'],
    [4, 'القطعة كويسة بس الشحن خد 3 أيام.', null],
    [5, 'ناس محترمة وبيردوا على طول.', null],
    [3, 'السعر عالي شوية بس القطعة أصلي.', 'أسعارنا على قد الاستيراد يا فندم'],
  ],
  'seller-04': [
    [5, 'جبت منهم موتور وشغال زي الفل من 3 شهور.', null],
    [4, 'خبرة في الموتورات ونصحوني صح.', 'منورنا'],
    [5, null, null],
  ],
  'seller-07': [
    [5, 'فحصولي العربية ببلاش وعرفوا العطل على طول.', 'في الخدمة دايماً'],
    [4, 'المارش شغال كويس.', null],
  ],
  'seller-11': [
    [5, 'ركّبولي البطارية في البيت في أقل من ساعة.', null],
    [5, 'أسعار الكاوتش أحسن من أي مكان سألت فيه.', 'نورت يا كابتن'],
    [4, null, null],
  ],
};

const PART_REVIEWS: [number, string | null, string | null][] = [
  [5, 'القطعة مطابقة للوصف بالظبط.', 'شكراً لحضرتك'],
  [4, 'كويسة جداً.', null],
  [5, 'ركبت من غير أي مشكلة.', null],
];

async function main() {
  const remove = process.argv.includes('--remove');
  const env = loadEnv();
  const connection = await mongoose.createConnection(env.MONGO_URI).asPromise();
  const container = createContainer(connection, env);
  const { User, Part, Shop, Review, Contact, SavedPart, Report, Notification } = container.models;

  // Out with the last run's demo data, and nothing else.
  const old = await User.find({ email: new RegExp(`@${DEMO_DOMAIN.replace(/\./g, '\\.')}$`) })
    .select('_id')
    .lean();
  const oldIds = old.map((user) => user._id);
  if (oldIds.length) {
    const oldParts = (
      await Part.find({ sellerId: { $in: oldIds } })
        .select('_id')
        .lean()
    ).map((part) => part._id);
    const oldShops = (
      await Shop.find({ ownerId: { $in: oldIds } })
        .select('_id')
        .lean()
    ).map((shop) => shop._id);
    await Promise.all([
      Review.deleteMany({
        $or: [
          { authorId: { $in: oldIds } },
          { sellerId: { $in: oldIds } },
          { targetId: { $in: [...oldParts, ...oldShops] } },
        ],
      }),
      Contact.deleteMany({ $or: [{ userId: { $in: oldIds } }, { sellerId: { $in: oldIds } }] }),
      SavedPart.deleteMany({ partId: { $in: oldParts } }),
      Report.deleteMany({
        $or: [
          { reporterId: { $in: oldIds } },
          { targetId: { $in: [...oldIds, ...oldParts, ...oldShops] } },
        ],
      }),
      Notification.deleteMany({ userId: { $in: oldIds } }),
      Part.deleteMany({ _id: { $in: oldParts } }),
      Shop.deleteMany({ _id: { $in: oldShops } }),
    ]);
    await User.deleteMany({ _id: { $in: oldIds } });
  }
  console.log(`Removed the old demo data: ${oldIds.length} accounts and what they made.`);
  if (remove) {
    await connection.close();
    return;
  }

  // Nobody signs in as them.
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
  const now = Date.now();
  const daysAgo = (days: number, hours = 0) => new Date(now - (days * 24 + hours) * 3_600_000);

  const sellerIds = new Map<string, Types.ObjectId>();
  for (const [index, seller] of SELLERS.entries()) {
    const user = await User.create({
      fullName: seller.name,
      email: `seller${String(index + 1).padStart(2, '0')}@${DEMO_DOMAIN}`,
      phone: seller.phone,
      passwordHash,
      emailVerifiedAt: new Date(),
      isVerifiedSeller: seller.verified,
    });
    sellerIds.set(seller.key, user._id);
  }
  const buyerIds: Types.ObjectId[] = [];
  for (const [index, buyer] of BUYERS.entries()) {
    const user = await User.create({
      fullName: buyer.name,
      email: `buyer${String(index + 1).padStart(2, '0')}@${DEMO_DOMAIN}`,
      phone: buyer.phone,
      passwordHash,
      emailVerifiedAt: new Date(),
    });
    buyerIds.push(user._id);
  }

  const shopIds = new Map<string, Types.ObjectId>();
  for (const [index, shop] of SHOPS.entries()) {
    const seller = SELLERS.find((s) => s.key === shop.seller)!;
    const created = await Shop.create({
      ownerId: sellerIds.get(shop.seller),
      name: seller.name,
      description: shop.description,
      logoUrl: shop.logo,
      coverUrl: shop.cover,
      phone: seller.phone,
      whatsapp: seller.phone,
      city: seller.city,
      address: shop.address,
      hours: shop.hours,
      brandIds: shop.brandIds,
      categories: shop.categories,
      delivery: shop.delivery,
      status: shop.status,
      approvedAt: shop.status === 'APPROVED' ? daysAgo(30 - index) : null,
      isVerified: shop.isVerified ?? false,
      isFeatured: shop.isFeatured ?? false,
    });
    // Only an approved shop's parts show under it.
    if (shop.status === 'APPROVED') shopIds.set(shop.seller, created._id);
  }

  const parts: DemoPart[] = [
    ...sampleParts.map((part, index) => ({
      seller: part.seller.id,
      name: part.name,
      category: part.category as PartCategory,
      condition: part.condition as DemoPart['condition'],
      isOriginal: part.isOriginal,
      price: part.price,
      oldPrice: part.oldPrice ?? undefined,
      partNumber: part.partNumber ?? undefined,
      description: part.description ?? '',
      images: part.images,
      fitments: part.fitments,
      isFeatured: part.isFeatured,
      daysAgo: index % 10,
    })),
    ...EXTRA_PARTS,
  ];
  const created = await Part.insertMany(
    parts.map((part, index) => {
      const seller = SELLERS.find((s) => s.key === part.seller)!;
      return {
        sellerId: sellerIds.get(part.seller),
        shopId: shopIds.get(part.seller) ?? null,
        name: part.name,
        category: part.category,
        condition: part.condition,
        isOriginal: part.isOriginal,
        price: part.price,
        oldPrice: part.oldPrice ?? null,
        partNumber: part.partNumber ?? null,
        description: part.description,
        images: part.images,
        fitments: part.fitments,
        city: seller.city,
        phone: seller.phone,
        isFeatured: part.isFeatured ?? false,
        isSold: false,
        listedAt: daysAgo(part.daysAgo, index % 12),
        stats: {
          views: 40 + ((index * 37) % 260),
          calls: 3 + ((index * 7) % 20),
          whatsapps: 5 + ((index * 11) % 30),
        },
        searchText: searchableText({
          name: part.name,
          partNumber: part.partNumber ?? null,
          category: part.category,
          city: seller.city,
          sellerName: seller.name,
          fitments: part.fitments,
        }),
      };
    }),
  );

  // Buyers who called, and what they said.
  const reviews: object[] = [];
  const contacts = new Map<
    string,
    { userId: Types.ObjectId; sellerId: Types.ObjectId; partIds: Types.ObjectId[] }
  >();
  const contact = (userId: Types.ObjectId, sellerId: Types.ObjectId, partId?: Types.ObjectId) => {
    const key = `${userId}-${sellerId}`;
    const row = contacts.get(key) ?? { userId, sellerId, partIds: [] };
    if (partId) row.partIds.push(partId);
    contacts.set(key, row);
  };
  for (const [sellerKey, said] of Object.entries(SHOP_REVIEWS)) {
    const sellerId = sellerIds.get(sellerKey)!;
    const shopId = shopIds.get(sellerKey)!;
    for (const [index, [rating, text, reply]] of said.entries()) {
      const authorId = buyerIds[index % buyerIds.length]!;
      const at = daysAgo(index * 3 + 1, index);
      contact(authorId, sellerId);
      reviews.push({
        target: 'SHOP',
        targetId: shopId,
        authorId,
        sellerId,
        shopId,
        rating,
        text,
        reply: reply ? { text: reply, at: new Date(at.getTime() + 3_600_000) } : null,
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  // A few reviews on the featured parts.
  for (const [partIndex, part] of created
    .filter((p) => p.isFeatured)
    .slice(0, 5)
    .entries()) {
    const said = PART_REVIEWS.slice(0, 3 - (partIndex % 2));
    for (const [index, [rating, text, reply]] of said.entries()) {
      const authorId = buyerIds[(partIndex + index + 2) % buyerIds.length]!;
      const at = daysAgo(index + 1, partIndex);
      contact(authorId, part.sellerId!, part._id);
      reviews.push({
        target: 'PART',
        targetId: part._id,
        authorId,
        sellerId: part.sellerId,
        shopId: part.shopId ?? null,
        rating,
        text,
        reply: reply ? { text: reply, at } : null,
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  await Contact.insertMany([...contacts.values()]);
  await Review.insertMany(reviews, { timestamps: false } as never);

  // The ratings, as the reviews service keeps them.
  const round = (value: number) => Math.round(value * 10) / 10;
  const rated = new Map<string, { target: string; id: Types.ObjectId; ratings: number[] }>();
  for (const review of reviews as { target: string; targetId: Types.ObjectId; rating: number }[]) {
    const key = `${review.targetId}`;
    const row = rated.get(key) ?? { target: review.target, id: review.targetId, ratings: [] };
    row.ratings.push(review.rating);
    rated.set(key, row);
  }
  for (const { target, id, ratings } of rated.values()) {
    const sum = ratings.reduce((a, b) => a + b, 0);
    const count = ratings.length;
    const avg = round(sum / count);
    if (target === 'PART') {
      await Part.updateOne({ _id: id }, { $set: { rating: { avg, count } } });
    } else {
      const score = (RATING_PRIOR.mean * RATING_PRIOR.weight + sum) / (RATING_PRIOR.weight + count);
      await Shop.updateOne({ _id: id }, { $set: { rating: { avg, count, score } } });
    }
  }

  console.log(
    `Demo data ready: ${SELLERS.length} sellers, ${BUYERS.length} buyers, ` +
      `${SHOPS.length} shops (${shopIds.size} approved), ${created.length} parts, ` +
      `${reviews.length} reviews.`,
  );
  await connection.close();
}

main().catch((error: unknown) => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
