import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { coachApiDevMiddleware } from "./vite-dev-coach-api";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: false, // Try next available port if 5173 is taken
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'development' && {
      name: 'coach-api-dev',
      configureServer(server) {
        server.middlewares.use(coachApiDevMiddleware());
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  optimizeDeps: {
    include: ['tesseract.js'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/tesseract\.js/, /node_modules/],
    },
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  ssr: {
    noExternal: ['tesseract.js'],
  },
}));
