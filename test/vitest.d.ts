/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Vitest injects `vi` globally in test files. This declaration lets
// TypeScript know about it without adding vitest/globals to tsconfig.
// NOTE: Do NOT add `import type` here — that turns this .d.ts into a
// module, making the global declarations invisible to other files.
declare var vi: typeof import("vitest")["vi"]
declare var it: typeof import("vitest")["it"]
declare var describe: typeof import("vitest")["describe"]
declare var expect: typeof import("vitest")["expect"]
declare var beforeEach: typeof import("vitest")["beforeEach"]
declare var afterEach: typeof import("vitest")["afterEach"]
declare var beforeAll: typeof import("vitest")["beforeAll"]
declare var afterAll: typeof import("vitest")["afterAll"]

// @testing-library/jest-dom vitest integration is loaded via
// `import "@testing-library/jest-dom/vitest"` in vitest-setup.ts,
// which augments vitest's Assertion/AsymmetricMatchersContaining interfaces.
// No additional augmentation needed here.
