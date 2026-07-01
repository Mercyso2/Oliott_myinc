import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'src/lib/repositories/post-repository.ts',
  'src/lib/repositories/generation-worker-repository.ts',
  'src/routes/planejamento.tsx',
  'src/routes/index.tsx'
].filter((file) => fs.existsSync(file));

const joined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.ok(!joined.includes('process-next-generation-job'), 'frontend ainda chama process-next-generation-job');
assert.ok(!joined.includes('process-production-queue'), 'frontend ainda chama process-production-queue antigo');
assert.ok(!joined.includes('generate-image-fast-safe'), 'frontend ainda referencia geração pesada Edge');
assert.match(joined, /enqueue-generation|Motor Local V2|Motor Local EXE/);
console.log('v2-no-heavy-edge ok');
