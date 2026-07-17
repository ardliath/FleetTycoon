/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Must match the GitHub repo name so asset URLs resolve under
  // https://<user>.github.io/FleetTycoon/ — update if the repo is renamed.
  base: '/FleetTycoon/',
  plugins: [react()],
  test: {
    // Ship-renderer snapshot tests use react-dom/server's renderToStaticMarkup,
    // which needs no DOM — plain Node is enough and keeps tests fast.
    environment: 'node',
  },
})
