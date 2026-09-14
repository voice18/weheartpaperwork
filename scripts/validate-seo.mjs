import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert(urls.length > 0, 'The exported sitemap must contain URLs');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
const titles = new Set();
const descriptions = new Set();
let breadcrumbs = 0;
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));

for (const url of urls) {
  const pathname = new URL(url).pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : `${pathname.slice(1)}.html`;
  const filename = fs.existsSync(path.join(dist, relative)) ? path.join(dist, relative) : path.join(dist, pathname.slice(1), 'index.html');
  const html = fs.readFileSync(filename, 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const canonicals = [...head.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => attr(tag, 'rel') === 'canonical');
  assert.equal(canonicals.length, 1, `${url}: expected exactly one canonical in the raw HTML head`);
  assert.equal(attr(canonicals[0], 'href'), url, `${url}: canonical must match sitemap`);
  const title = head.match(/<title\b[^>]*>(.*?)<\/title>/s)?.[1]?.trim();
  const description = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).find(tag => attr(tag, 'name') === 'description');
  const text = description && attr(description, 'content');
  assert(title && text, `${url}: missing title or description`);
  assert(!titles.has(title), `${url}: duplicate title`);
  assert(!descriptions.has(text), `${url}: duplicate description`);
  titles.add(title);
  descriptions.add(text);
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    const data = JSON.parse(match[1]);
    return data['@graph'] ?? [data];
  });
  if (/^\/(compliance|how-to)\//.test(pathname)) {
    const breadcrumb = schemas.filter(schema => schema['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb.length, 1, `${url}: expected one breadcrumb list`);
    const items = breadcrumb[0].itemListElement;
    assert.equal(items.length, 3, `${url}: expected Home, category, page`);
    items.forEach((item, index) => {
      assert.equal(item.position, index + 1);
      assert(item.name && urls.includes(item.item), `${url}: breadcrumb target must exist in sitemap`);
    });
    assert.equal(items[2].item, url);
    breadcrumbs++;
  }
  if (pathname.startsWith('/tools/')) {
    // Firebase source globs without a slash also match the slashed directory
    // URL. Redirecting such a source to itself plus '/' creates a live loop.
    if (pathname.endsWith('/')) {
      assert(!config.hosting.redirects.some(rule => rule.source?.replace(/\/$/, '') === pathname.slice(0, -1)), `${url}: directory tool must not have a slash-adding glob redirect`);
      continue;
    }
    const alternate = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname + '/';
    const redirect = config.hosting.redirects.find(rule => rule.source === alternate);
    assert(redirect, `${url}: missing redirect from alternate slash variant`);
    assert.equal(redirect.type, 301);
    assert.equal(redirect.destination, pathname);
    assert(!config.hosting.redirects.some(rule => rule.source === pathname), `${url}: canonical must not redirect`);
  }
}
// Links must exist before JavaScript runs; click handlers alone are not enough.
const toolPaths = urls.map(url => new URL(url).pathname).filter(p => p.startsWith('/tools/'));
for (const relative of ['index.html', 'tools/index.html', 'how-to/index.html']) {
  const html = fs.readFileSync(path.join(dist, relative), 'utf8');
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map(match => attr(match[0], 'href'));
  for (const toolPath of toolPaths) assert(anchors.includes(toolPath), `${relative}: missing crawlable link to ${toolPath}`);
  assert(anchors.includes('/tools'), `${relative}: missing crawlable link to tool directory`);
  assert(!/<div\b[^>]*role="link"/i.test(html), `${relative}: navigation still uses a div instead of a link`);
}
console.log(`SEO validation passed: ${urls.length} sitemap pages with unique metadata and matching canonicals; ${breadcrumbs} breadcrumb lists; calculator redirect and directory-tool loop prevention; all tool links in homepage, tool directory, and how-to library.`);
