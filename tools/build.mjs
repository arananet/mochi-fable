// Empaqueta los módulos de src/ en un único dist/index.html jugable sin servidor.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url);
const order = ['core', 'audio', 'actors', 'world', 'main'];
const js = order.map(n => `// ---- ${n}.js ----\n` + readFileSync(new URL(`src/${n}.js`, root), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n');
const html = readFileSync(new URL('index.html', root), 'utf8')
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>`);
mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/index.html', root), html);
// variante sin esqueleto de documento, para publicar como página incrustada
const style = html.match(/<style>[\s\S]*?<\/style>/)[0], body = html.slice(html.indexOf('<canvas'), html.indexOf('</body>'));
writeFileSync(new URL('dist/mochi-fable.html', root), `<title>Mochi Fable</title>\n${style.replace('<style>', '<style>:root{color-scheme:dark}')}\n${body}`);
console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
