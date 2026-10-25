import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readClientConfiguration } from './src/lib/clientConfiguration.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A dedicated demo build never bundles the signed-in production application.
  const labOnly = process.env.WILO_LAB_ONLY === 'true'
  readClientConfiguration(env)
  if (labOnly && env.VITE_USE_EMULATORS !== 'true') throw new Error('WILO lab requires emulator-mode isolation')
  return {
    plugins: [react()],
    ...(labOnly
      ? { build: { rolldownOptions: { input: { lab: 'assistant-lab.html' } } } }
      : env.VITE_USE_EMULATORS === 'true'
        ? { build: { rolldownOptions: { input: { main: 'index.html', lab: 'assistant-lab.html' } } } }
        : {}),
  }
})
