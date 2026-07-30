import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only proxy so the SPA can call `/api` without CORS headaches while the
// backend runs on :4000. Production builds hit VITE_API_BASE_URL directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
