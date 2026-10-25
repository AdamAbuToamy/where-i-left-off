import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readClientConfiguration } from './src/lib/clientConfiguration.ts'

export default defineConfig(({ mode }) => {
  // Check values before Vite can inline them. Errors contain no credential values.
  readClientConfiguration(loadEnv(mode, process.cwd(), 'VITE_'))
  return { plugins: [react()], ...(loadEnv(mode, process.cwd(), 'VITE_').VITE_USE_EMULATORS === 'true' ? { build: { rolldownOptions: { input: { main: 'index.html', lab: 'assistant-lab.html' } } } } : {}) }
})
