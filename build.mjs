import { mkdir, cp, copyFile, unlink } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const legacy of ['app.js', 'engine.js']) await unlink(`dist/${legacy}`).catch(error => { if (error.code !== 'ENOENT') throw error; });
for (const file of ['index.html', 'style.css', 'workshop.js', 'games.js', 'standalone.js', 'runninghub.js']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true });
console.log('Built static site in dist/');
