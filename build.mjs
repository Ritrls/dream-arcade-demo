import { mkdir, cp, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(projectDirectory, 'dist');
if (dirname(outputDirectory) !== projectDirectory || !outputDirectory.endsWith('dist')) throw Error('Unexpected build output directory');
// Only this project's generated output is removed; source and user data are outside it.
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
for (const file of ['index.html', 'style.css', 'lab.js', 'battle.js', 'unit-model.js', 'mining-rules.js', 'unit-generator.js', 'unit-library.js', 'unit-store.js', 'portable.js', 'runninghub.js']) await copyFile(resolve(projectDirectory,file), resolve(outputDirectory,file));
await cp(resolve(projectDirectory,'assets'), resolve(outputDirectory,'assets'), { recursive: true });
await copyFile(resolve(projectDirectory,'docs/preview.png'), resolve(outputDirectory,'preview.png'));
console.log('Built static site in dist/');
