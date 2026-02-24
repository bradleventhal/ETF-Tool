import { rmSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const root = '/vercel/share/v0-project';

// Try to find and delete any build cache
const dirs = ['.next', '.turbo', 'node_modules/.cache', 'node_modules/.vite'];
for (const d of dirs) {
  const p = join(root, d);
  if (existsSync(p)) {
    console.log(`Found ${d}, deleting...`);
    try {
      rmSync(p, { recursive: true, force: true });
      console.log(`Deleted ${d}`);
    } catch (e) {
      console.log(`Failed to delete ${d}: ${e.message}`);
    }
  } else {
    console.log(`${d} does not exist`);
  }
}

// List what's at root
console.log('\nRoot contents:');
readdirSync(root).forEach(f => console.log(`  ${f}`));
