import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the site works on GitHub Pages at /<repo>/ and on a custom domain.
export default defineConfig({ plugins: [react()], base: "./", resolve: { alias: { "@": "/src" } } });
