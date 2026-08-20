import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://naogify.github.io/meeting-room-app/ on GitHub Pages, so
// production assets need that prefix. `vite dev` keeps the root path.
const base = process.env.VITE_BASE ?? '/meeting-room-app/';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? base : '/',
  server: { port: 5173 },
}));
