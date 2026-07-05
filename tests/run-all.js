import { execSync } from 'child_process';
import path from 'path';
import fileurl from 'url';

const __dirname = path.dirname(fileurl.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('--------------------------------------------------');
console.log('  E2E & Component Test Suite Runner');
console.log('  Project: Personal Knowledge Graph');
console.log('--------------------------------------------------');

try {
  console.log('\n[INFO] Executing Vitest test suite across Tier 1..4...\n');
  execSync('npx vitest run', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  console.log('\n[SUCCESS] All E2E test suites passed successfully!');
} catch (err) {
  console.error('\n[ERROR] Vitest run failed or vitest not found. Running custom test executor...\n');
  process.exit(1);
}
