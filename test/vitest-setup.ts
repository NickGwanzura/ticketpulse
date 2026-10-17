import "@testing-library/jest-dom/vitest"

// Node 25+ ships an experimental global `localStorage` that is unusable without
// --localstorage-file and hides jsdom's own. Install a plain in-memory Storage
// on window when it is missing so storage-based tests pass on any Node version.
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key) },
    setItem: (key, value) => { data.set(key, String(value)) },
  }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  let usable = false
  try { usable = typeof window !== "undefined" && typeof window[name]?.clear === "function" } catch { usable = false }
  if (!usable && typeof window !== "undefined") {
    Object.defineProperty(window, name, { value: memoryStorage(), configurable: true })
    Object.defineProperty(globalThis, name, { value: window[name], configurable: true })
  }
}

// Mock Next.js navigation hooks globally for component tests.
// Individual test files can override these with vi.mock() if needed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/headers — used by server components and API routes.
vi.mock("next/headers", () => ({
  headers: () =>
    new Map([["x-pathname", "/"]]),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

// Ensure `server-only` module doesn't throw in test environment.
// Vitest runs in Node, so `server-only` would normally break.
vi.mock("server-only", () => ({}))
