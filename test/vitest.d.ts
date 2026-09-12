/* eslint-disable @typescript-eslint/no-explicit-any, no-var */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Vitest injects `vi` globally in test files. This declaration lets
// TypeScript know about it without adding vitest/globals to tsconfig.
// NOTE: Do NOT add `import type` here — that turns this .d.ts into a
// module, making the global declarations invisible to other files.
declare const vi: typeof import("vitest")["vi"]
declare const it: typeof import("vitest")["it"]
declare const describe: typeof import("vitest")["describe"]
declare const expect: typeof import("vitest")["expect"]
declare const beforeEach: typeof import("vitest")["beforeEach"]
declare const afterEach: typeof import("vitest")["afterEach"]
declare const beforeAll: typeof import("vitest")["beforeAll"]
declare const afterAll: typeof import("vitest")["afterAll"]

// @testing-library/jest-dom vitest integration is loaded via
// `import "@testing-library/jest-dom/vitest"` in vitest-setup.ts,
// which augments vitest's Assertion/AsymmetricMatchersContaining interfaces.
// No additional augmentation needed here.
