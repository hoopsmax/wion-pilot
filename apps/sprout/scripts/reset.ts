import { join, resolve } from 'node:path';
import { writeJsonFileAtomic } from '../src/server/json-file.ts';
import { readSproutData } from '../src/server/store.ts';

// Restores the made-up seed data. The server reads the data file on every request, so this
// also works while `npm run demo` is running; open browsers pick it up at their next sync.
const appFolder = resolve(import.meta.dirname, '..');
const seedFile = join(appFolder, 'data/seed.json');
const dataFile = resolve(process.env['SPROUT_DATA_FILE'] ?? join(appFolder, 'data/db.json'));

await writeJsonFileAtomic(dataFile, await readSproutData(seedFile));
console.log(`Sprout data reset to the seed data: ${dataFile}`);
