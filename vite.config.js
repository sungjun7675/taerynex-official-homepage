import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  // This static marketing site needs no environment variables or backend client.
  envDir: false,
  envPrefix: "TAERYNEX_PUBLIC_UNUSED_",
  appType: "mpa",
  plugins: [react()],
});
