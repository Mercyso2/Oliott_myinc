import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export async function saveStatus(status) {
  const base = process.env.MYINC_ENGINE_CWD || process.cwd();
  const dir = resolve(base, '.myinc-engine');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'status.json'), JSON.stringify({ ...status, updated_at: new Date().toISOString() }, null, 2));
}
