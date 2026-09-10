// Trusted server CLI only: keep normal React rendering while satisfying the
// framework's build-time server-only marker. Never import this in browser code.
import { registerHooks } from "node:module"
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: new URL("../node_modules/server-only/empty.js", import.meta.url).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
