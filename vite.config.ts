import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: true, // Show errors in the browser overlay
    },
    watch: {
      usePolling: false, // Set to true if you're on a network filesystem
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
