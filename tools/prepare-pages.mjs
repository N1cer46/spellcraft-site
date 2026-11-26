import { copyFile, rm, writeFile } from 'node:fs/promises';

await rm('dist/public/__manus__', { recursive: true, force: true });
await copyFile('dist/public/index.html', 'dist/public/404.html');
await writeFile('dist/public/.nojekyll', '');
