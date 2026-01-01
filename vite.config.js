import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    https: true,
    watch: {
      usePolling: true, // Needed for WSL/Windows
    },
    hmr: true,
  },
});
