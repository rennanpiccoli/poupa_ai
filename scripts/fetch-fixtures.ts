// Refreshes the HTML fixtures used by the parser tests: `npm run fixtures`.
// For each chain: one search page (first N product tiles) + the first product page,
// stripped of scripts/styles/chrome so the files stay small and diffable.
// Re-run when a site changes, then fix the parser until tests pass again.
import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";

const TERM = "leite proteina";
const MAX_TILES = 6;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

interface ChainFixture {
  chain: string;
  searchUrl: (q: string) => string;
  tile: string; // CSS selector of a product tile in the search page
  productUrl: ($tile: cheerio.Cheerio<never>) => string | undefined;
}

const CHAINS: ChainFixture[] = [
  {
    chain: "continente",
    searchUrl: (q) => `https://www.continente.pt/pesquisa/?q=${encodeURIComponent(q)}`,
    tile: ".product-tile",
    productUrl: (t) => t.find("a").first().attr("href"),
  },
  {
    chain: "auchan",
    searchUrl: (q) => `https://www.auchan.pt/pt/pesquisa?q=${encodeURIComponent(q)}`,
    tile: ".product-tile",
    productUrl: (t) => {
      const urls = t.attr("data-urls");
      return urls ? JSON.parse(urls).absoluteProductUrl : undefined;
    },
  },
  {
    chain: "pingodoce",
    searchUrl: (q) =>
      `https://www.pingodoce.pt/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q=${encodeURIComponent(q)}`,
    tile: "div.product[data-pid]",
    productUrl: (t) => {
      const href = t.find("a").first().attr("href");
      return href ? new URL(href, "https://www.pingodoce.pt").toString() : undefined;
    },
  },
];

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Remove everything a parser never needs. Keeps JSON-LD (product data lives there). */
function strip($: cheerio.CheerioAPI) {
  $("script").not('[type="application/ld+json"]').remove();
  $("style, svg, noscript, iframe, link, meta, header, footer, nav").remove();
  $("img").removeAttr("srcset").removeAttr("sizes");
  $("*")
    .contents()
    .filter((_, n) => n.type === "comment")
    .remove();
}

function minify(html: string): string {
  return html.replace(/\n\s*\n+/g, "\n").replace(/[ \t]+/g, " ");
}

for (const c of CHAINS) {
  const dir = `tests/fixtures/${c.chain}`;
  await mkdir(dir, { recursive: true });

  const searchUrl = c.searchUrl(TERM);
  const $s = cheerio.load(await get(searchUrl));
  const tiles = $s(c.tile).slice(0, MAX_TILES);
  if (tiles.length === 0) throw new Error(`${c.chain}: no tiles found with "${c.tile}"`);
  const productUrl = c.productUrl(tiles.first() as cheerio.Cheerio<never>);
  const tilesHtml = tiles.map((_, el) => $s.html(el)).get();
  const $t = cheerio.load(
    `<html><body><div class="fixture-tiles">${tilesHtml.join("\n")}</div></body></html>`,
  );
  strip($t);
  await writeFile(`${dir}/search.html`, minify($t.html()));

  if (!productUrl) throw new Error(`${c.chain}: no product url in first tile`);
  const $p = cheerio.load(await get(productUrl));
  strip($p);
  // Keep JSON-LD + the main product block only.
  const ld = $p('script[type="application/ld+json"]')
    .map((_, el) => $p.html(el))
    .get();
  const main = $p(".product-detail, .product-wrapper, [data-pid]").first();
  await writeFile(
    `${dir}/product.html`,
    minify(`<html><head>${ld.join("\n")}</head><body>${main.length ? $p.html(main) : ""}</body></html>`),
  );

  const meta = { chain: c.chain, term: TERM, searchUrl, productUrl, fetchedAt: new Date().toISOString() };
  await writeFile(`${dir}/meta.json`, JSON.stringify(meta, null, 2) + "\n");
  console.log(`✅ ${c.chain}: ${tiles.length} tiles, product ${productUrl}`);
}
