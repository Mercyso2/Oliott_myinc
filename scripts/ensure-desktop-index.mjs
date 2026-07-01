import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const clientDir = join(process.cwd(), 'dist', 'client');
const assetsDir = join(clientDir, 'assets');
const indexPath = join(clientDir, 'index.html');

function fail(message) {
  console.error(`[ensure-desktop-index] ${message}`);
  process.exit(1);
}

if (!existsSync(clientDir)) fail('dist/client nao existe. Rode npm run build primeiro.');
if (!existsSync(assetsDir)) fail('dist/client/assets nao existe. Build client incompleto.');

const assets = readdirSync(assetsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const css = assets.find((name) => /^styles-.*\.css$/.test(name));
const js = assets
  .filter((name) => /^index-.*\.js$/.test(name))
  .sort((a, b) => statSync(join(assetsDir, b)).size - statSync(join(assetsDir, a)).size)[0];

if (!js) fail('Nenhum bundle principal index-*.js encontrado em dist/client/assets.');
if (!css) fail('Nenhum styles-*.css encontrado em dist/client/assets.');

writeFileSync(indexPath, `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MYINC Social Media AI</title>
    <script type="module" crossorigin src="./assets/${js}"></script>
    <link rel="stylesheet" crossorigin href="./assets/${css}" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`, 'utf8');

console.log(`[ensure-desktop-index] criado ${indexPath} -> ${js}, ${css}`);
