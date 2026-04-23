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
    outDir: "dist-electron",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: "node20",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./electron/main.ts", import.meta.url)),
        preload: fileURLToPath(new URL("./electron/preload.ts", import.meta.url))
      },
      external: [/^node:/, "electron", "keytar", "sql.js"],
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js"
      }
    }
  }
})
