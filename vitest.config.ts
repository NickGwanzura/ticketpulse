import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    testTimeout: 15_000,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/vitest-setup.ts"],
    include: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e/**", "mobile/**", "ios/**", "android/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "app/api/**/*.ts",
        "components/**/*.tsx",
        "db/**/*.ts",
      ],
      exclude: [
        "lib/groq.ts",
        "lib/email.ts",
        "lib/r2.ts",
        "**/*.d.ts",
        "**/route.ts",
      ],
      reporter: ["text", "html", "lcov"],
    },
    // Provide a lightweight mock for Next.js `server-only` module
    // which doesn't exist as an installable package outside Next's bundler.
    server: {
      deps: {
        inline: ["server-only"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js internal module — Vitest can't resolve it natively
      "server-only": path.resolve(__dirname, "test/__mocks__/server-only.ts"),
    },
  },
})
