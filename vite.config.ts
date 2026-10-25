import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readClientConfiguration } from './src/lib/clientConfiguration.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Lab-only preview uses a demo project and never bundles the signed-in app.
  const labOnly = process.env.WILO_LAB_ONLY === 'true'
  readClientConfiguration(env)
  if (labOnly && env.VITE_USE_EMULATORS !== 'true') throw new Error('WILO lab requires emulator-mode isolation')

  // A single typed object avoids a discriminated union with optional undefined
  // inputs, which Vite's Rolldown InputOption does not accept.
  let input: Record<string, string> | undefined
  if (labOnly) input = { lab: 'assistant-lab.html' }
  else if (env.VITE_USE_EMULATORS === 'true') input = { main: 'index.html', lab: 'assistant-lab.html' }

  return {
    plugins: [react()],
    ...(input ? { build: { rolldownOptions: { input } } } : {}),
  }
})
