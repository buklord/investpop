import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const cacheDir = path.join(process.cwd(), '.next', 'cache');
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    // eslint-disable-next-line no-console
    console.log(`[postbuild] Removed ${cacheDir}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[postbuild] Failed to remove .next/cache (continuing):', err?.message || err);
  }
}

await main();
