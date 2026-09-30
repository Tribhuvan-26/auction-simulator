import 'dotenv/config'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// DB tests create and delete rows; only run them against a local database so a
// dev `.env` pointed at production never gets test rooms written into it.
const localDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')
const dbTests = ['prisma/seed.test.ts', 'src/app/admin/\[roomId\]/actions.test.ts']

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, ...(localDb ? [] : dbTests)],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
