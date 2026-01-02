import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [basicSsl(), viteSingleFile()],
  server: {
    https: true,
    watch: {
      usePolling: true, // Needed for WSL/Windows
    },
    hmr: true,
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000, // Inline assets under 100KB as base64
  },
});
