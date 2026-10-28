import { defineConfig } from 'vitest/config'
const rules = ['tests/sessionWorkspaceSecurity.test.ts', 'tests/assistantHttpPersistence.test.ts', 'tests/assistantCorpusSecurity.test.ts', 'tests/assistantTaskAcceptance.test.tsx', 'tests/studyWorkflowSecurity.test.ts', 'tests/legacyAccessSecurity.test.ts', 'tests/assistantSecurity.test.ts', 'tests/studySecurity.test.ts', 'tests/directAccessSecurity.test.ts', 'tests/feedbackSecurity.test.ts', 'tests/firestore.test.ts', 'tests/groups.test.ts', 'tests/logSecurity.test.ts', 'tests/accountSecurity.test.ts', 'tests/workflowSecurity.test.ts']
const security = process.env.TEST_SUITE === 'security'
const authSuite = process.env.TEST_SUITE === 'auth'
const authTests = ['tests/authRecoveryEmulator.test.ts']
if (security && !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Security tests require Firestore emulator. Run npm run test:rules.')
}
export default defineConfig({ test: {
  include: authSuite ? authTests : security ? rules : ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  exclude: security || authSuite ? [] : [...rules,...authTests],
  testTimeout: 20000, hookTimeout: 30000, fileParallelism: false,
} })
