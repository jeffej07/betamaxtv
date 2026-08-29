import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change "base" to match your GitHub repo name before deploying,
// e.g. if your repo is github.com/yourname/betamaxtv, base should be "/betamaxtv/".
// If you deploy to a custom domain instead, set base back to "/".
export default defineConfig({
  plugins: [react()],
  base: "/betamaxtv/",
});
