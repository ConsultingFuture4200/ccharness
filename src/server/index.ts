/**
 * Read-only dashboard server surface (PRD §4.6, Milestone E).
 *
 * Re-exports the localhost HTTP layer. The CLI's `serve` command and any test
 * consume only what is exported here. No mutating endpoints exist (PRD §4.6).
 */
export {
  type ApiContext,
  ROUTES,
  assertReadOnly,
  createApiServer,
  defaultWebRoot,
  serve,
} from "./api.js";
