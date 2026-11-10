import {copyFile,writeFile} from 'node:fs/promises';
await copyFile('dist/public/index.html','dist/public/404.html');
await writeFile('dist/public/.nojekyll','');
