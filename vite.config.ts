import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readClientConfiguration } from './src/lib/clientConfiguration.ts'

export default defineConfig(({ mode }) => {
  // Check values before Vite can inline them. Errors contain no credential values.
  readClientConfiguration(loadEnv(mode, process.cwd(), 'VITE_'))
  return { plugins: [react()] }
})
