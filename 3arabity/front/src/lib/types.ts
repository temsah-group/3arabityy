// Shapes from the backend's docs/api-contract.md.

export type Category =
  | 'ENGINE'
  | 'BRAKES'
  | 'SUSPENSION'
  | 'ELECTRICAL'
  | 'BODY'
  | 'LIGHTS'
  | 'FILTERS'
  | 'TYRES';
export type Condition = 'NEW' | 'USED' | 'IMPORTED';
export type Origin = 'ORIGINAL' | 'AFTERMARKET';
export type Sort = 'NEWEST' | 'PRICE_LOW' | 'PRICE_HIGH';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  profilePhotoUrl: string | null;
  accountType: 'USER' | 'SELLER';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  emailVerification: { isVerified: boolean; verifiedAt: string | null };
  hasPassword: boolean;
  signedInWithGoogle: boolean;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Fitment {
  brandId: string;
  modelId: string;
  fromYear: number;
  toYear: number;
}

export interface Rating {
  avg: number;
  count: number;
}

export interface ShopSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  rating: Rating;
  delivers: boolean;
}

export interface Part {
  id: string;
  name: string;
  category: Category;
  condition: Condition;
  isOriginal: boolean;
  price: number;
  oldPrice: number | null;
  partNumber: string | null;
  description: string | null;
  images: string[];
  fitments: Fitment[];
  city: string;
  isFeatured: boolean;
  isSold: boolean;
  isHidden?: boolean;
  listedAt: string;
  rating?: Rating;
  shop: ShopSummary | null;
  seller: { id: string; name: string; phone: string; photoUrl: string | null; verified: boolean };
  isSaved?: boolean;
  stats?: { views: number; calls: number; whatsapps: number };
}

export interface PartInput {
  name: string;
  category: Category;
  condition: Condition;
  isOriginal: boolean;
  price: number;
  oldPrice: number | null;
  partNumber: string | null;
  description: string | null;
  images: string[];
  fitments: Fitment[];
  city: string;
  phone: string;
}

export interface Seller {
  id: string;
  name: string;
  city: string | null;
  photoUrl: string | null;
  verified: boolean;
  partsCount: number;
  categoriesCount: number;
  firstListedAt: string | null;
  phone: string | null;
  shopId: string | null;
}

export interface Delivery {
  available: boolean;
  governorates: string[];
  feeFrom: number | null;
  feeTo: number | null;
  eta: string | null;
  note: string | null;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string;
  whatsapp: string | null;
  city: string;
  address: string;
  location: { lat: number; lng: number } | null;
  hours: string | null;
  brandIds: string[];
  categories: Category[];
  delivery: Delivery;
  verified: boolean;
  featured: boolean;
  rating: Rating;
  delivers: boolean;
  partsCount: number;
  createdAt: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  statusReason?: string | null;
  hidden?: boolean;
}

export type ShopInput = Pick<
  Shop,
  | 'name'
  | 'description'
  | 'phone'
  | 'whatsapp'
  | 'city'
  | 'address'
  | 'hours'
  | 'brandIds'
  | 'categories'
  | 'delivery'
>;

export interface Review {
  id: string;
  target: 'SHOP' | 'PART';
  targetId: string;
  rating: number;
  text: string | null;
  author: { name: string; photoUrl: string | null };
  reply: { text: string; at: string } | null;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
  targetName?: string;
}

export interface ReviewsPage extends Page<Review> {
  summary?: { avg: number; count: number; breakdown: number[] };
  mine?: Review | null;
  canReview?: boolean;
}

export type NotificationKind =
  | 'FITS_YOUR_CAR'
  | 'PRICE_DROP'
  | 'LISTING'
  | 'SHOP'
  | 'REVIEW'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  partId: string | null;
  shopId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  fitsMyCar: boolean;
  priceDrops: boolean;
  news: boolean;
}

export interface GarageCar {
  brandId: string;
  modelId: string;
  year: number;
}

export interface CarModel {
  id: string;
  nameAr: string;
  nameEn: string;
  fromYear: number;
  toYear: number | null;
}

export interface CarBrand {
  id: string;
  nameAr: string;
  nameEn: string;
  models: CarModel[];
}

export interface DocSection {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

export interface Offer {
  id: string;
  tagAr: string;
  tagEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string | null;
  subtitleEn: string | null;
  image: string;
  condition: Condition | null;
}

export interface AppConfig {
  support: { email: string; phone: string; whatsapp: string } | null;
  terms: { sections: DocSection[]; updatedAt: string | null };
  privacy: { sections: DocSection[]; updatedAt: string | null };
  faq: { sections: DocSection[]; updatedAt: string | null };
  cars: { brands: CarBrand[]; updatedAt: string | null };
  announcement: {
    id: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    createdAt: string;
  } | null;
  offers: Offer[];
}

export interface HomeData {
  featured: Part[];
  latest: Part[];
  fittingCount: number;
  shops: Shop[];
}

export interface SearchResult extends Page<Part> {
  facets?: { cities: string[]; maxPrice: number };
}

export type ReportReason =
  | 'FAKE'
  | 'WRONG_INFO'
  | 'COUNTERFEIT'
  | 'STOLEN'
  | 'SCAM'
  | 'UNREACHABLE'
  | 'ABUSIVE'
  | 'OTHER';
