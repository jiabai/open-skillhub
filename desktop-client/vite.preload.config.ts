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
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    target: "node20",
    rollupOptions: {
      input: {
        preload: fileURLToPath(new URL("./electron/preload.ts", import.meta.url))
      },
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "[name].js",
        inlineDynamicImports: true
      }
    }
  }
})
