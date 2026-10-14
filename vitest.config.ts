import { defineConfig } from 'vitest/config'
const rules = ['tests/firestore.test.ts', 'tests/groups.test.ts', 'tests/logSecurity.test.ts', 'tests/accountSecurity.test.ts', 'tests/workflowSecurity.test.ts']
const security = process.env.TEST_SUITE === 'security'
if (security && !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Security tests require Firestore emulator. Run npm run test:rules.')
}
export default defineConfig({ test: {
  include: security ? rules : ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  exclude: security ? [] : rules,
  testTimeout: 20000, hookTimeout: 30000, fileParallelism: false,
} })
