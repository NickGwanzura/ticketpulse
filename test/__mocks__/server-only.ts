// Empty module — replaces Next.js's `server-only` package in test environment.
// The real `server-only` module throws when imported from a client bundle,
// but in Vitest (which runs in Node) we want no-op behaviour.
export {}
