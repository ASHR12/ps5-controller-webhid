import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'ps5-controller-webhid/react',
        replacement: fileURLToPath(
          new URL('./src/dualsense/react.ts', import.meta.url),
        ),
      },
      {
        find: 'ps5-controller-webhid',
        replacement: fileURLToPath(
          new URL('./src/dualsense/index.ts', import.meta.url),
        ),
      },
    ],
  },
})
