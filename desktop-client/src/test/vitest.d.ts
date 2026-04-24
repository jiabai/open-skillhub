import "@testing-library/jest-dom/vitest"
import "vitest"

declare global {
  const describe: typeof import("vitest")["describe"]
  const it: typeof import("vitest")["it"]
  const expect: typeof import("vitest")["expect"]
  const beforeAll: typeof import("vitest")["beforeAll"]
  const afterAll: typeof import("vitest")["afterAll"]
  const beforeEach: typeof import("vitest")["beforeEach"]
  const afterEach: typeof import("vitest")["afterEach"]
}
