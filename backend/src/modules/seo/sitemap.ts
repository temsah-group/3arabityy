import { Router } from 'express';

import { VISIBLE, type PartModel } from '../parts/part.model.js';
import { OPEN_SHOP, type ShopModel } from '../shops/shop.model.js';

/** The pages of the website that are the same for everyone. */
const PAGES = ['/', '/search', '/shops', '/help', '/legal/terms', '/legal/privacy'];
/** One sitemap holds 50,000 addresses at most; the newest parts go first. */
const MAX_PARTS = 45_000;

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entry = (loc: string, lastmod?: Date) =>
  `<url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`;

/**
 * `GET /sitemap.xml`: the website's pages, every part for sale and every open
 * shop, as addresses on [site] (the website, not this API). The website's
 * robots.txt points search engines here.
 */
export function sitemapRoutes(site: string, parts: PartModel, shops: ShopModel): Router {
  const origin = site.replace(/\/+$/, '');
  const router = Router();
  router.get('/sitemap.xml', async (_req, res) => {
    const [forSale, open] = await Promise.all([
      parts
        .find({ ...VISIBLE, isSold: false }, { _id: 1, updatedAt: 1 })
        .sort({ listedAt: -1 })
        .limit(MAX_PARTS)
        .lean()
        .exec(),
      shops.find(OPEN_SHOP, { _id: 1, updatedAt: 1 }).lean().exec(),
    ]);
    const urls = [
      ...PAGES.map((page) => entry(`${origin}${page}`)),
      ...open.map((shop) => entry(`${origin}/shops/${String(shop._id)}`, shop.updatedAt)),
      ...forSale.map((part) => entry(`${origin}/parts/${String(part._id)}`, part.updatedAt)),
    ];
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      );
  });
  return router;
}
