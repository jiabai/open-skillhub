import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    ssr: true,
    outDir: "dist-cli",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: "node20",
    rollupOptions: {
      input: {
        "skilldrive-cli": fileURLToPath(new URL("./src/cli/main.ts", import.meta.url))
      },
      external: [/^node:/, "sql.js"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js"
      }
    }
  }
})
