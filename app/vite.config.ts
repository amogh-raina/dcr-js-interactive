import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const defaultBasePath = env.VERCEL ? "/" : "/dcr-js/";

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || defaultBasePath,
  };
});
