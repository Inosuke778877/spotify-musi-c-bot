import { readFile, writeFile } from 'fs/promises';

const file = './plugins/deezer.js';
let content = await readFile(file, 'utf8');

// Replace the simple error check with better handling
content = content.replace(
    'if (data.error) throw new Error(data.error.message);',
    `if (data.error) {
            throw new Error(data.error.message || 'Deezer API error');
        }

        if (!data.id || !data.title) {
            throw new Error('Invalid track data from Deezer');
        }`
);

await writeFile(file, content, 'utf8');
console.log('✅ Fixed Deezer error handling');
