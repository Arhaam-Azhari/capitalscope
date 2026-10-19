import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const entry = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/);
if (!entry) throw new Error('I could not find the production module entry.');
const source = readFileSync(resolve(dist, entry[1].replace(/^\//, '')));
const compressed = gzipSync(source).byteLength;
// I budget the entry script separately from sections downloaded later.
if (source.byteLength > 300000 || compressed > 100000) {
  throw new Error(`My entry-script budget is 300000 bytes / 100000 gzip bytes; received ${source.byteLength} / ${compressed}.`);
}
console.log(`I checked the entry-script budget: ${source.byteLength} bytes / ${compressed} gzip bytes.`);
