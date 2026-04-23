import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// Read icon SVG at build time and embed it
const iconSvgPath = fileURLToPath(new URL("./resources/icons/icon.svg", import.meta.url))
const embeddedIconSvg = readFileSync(iconSvgPath, "utf8").trim()

export default defineConfig({
  publicDir: false,
  define: {
    // Inject SVG content as global constant
    __EMBEDDED_ICON_SVG__: JSON.stringify(embeddedIconSvg)
  },
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
