import "@testing-library/jest-dom/vitest"

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
