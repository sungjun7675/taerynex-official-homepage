import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from 'node:path';

export default defineConfig({
  base: "/",
  // Public contact config is explicit; never load the historical local env.
  envDir: false,
  envPrefix: "TAERYNEX_PUBLIC_UNUSED_",
  appType: "mpa",
  plugins: [react()],
  build: { rollupOptions: { input: { main: resolve('index.html'), operator: resolve('admin/inquiries.html') } } },
});
