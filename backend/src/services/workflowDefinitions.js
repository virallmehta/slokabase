import { coreWorkflowDefinitions } from '#config/coreWorkflowDefinitions.js';

/**
 * modules/index.js pushes the registry in via setModules() once it's built,
 * rather than this file importing `modules` from '#modules/index.js'
 * directly. A module's own controller/validators can statically import
 * workflowService.js (transitively, this file) while #modules/index.js is
 * still mid-build (its dynamic `import()` of that module's routes.js,
 * inside its own top-level `await Promise.all(...)`) — a static import
 * here of '#modules/index.js' would put that still-evaluating module back
 * into this file's dependency graph, a cycle that deadlocks Node's ESM
 * loader (the dynamic import() never resolves) rather than merely racing
 * a TDZ. Taking the registry as a plain function call after index.js has
 * fully finished sidesteps the cycle entirely.
 */
let registeredModules = [];

export function setModules(modules) {
  registeredModules = modules;
}

export function getWorkflowDefinitions() {
  const declared = registeredModules.flatMap((mod) => (mod.workflow ? [mod.workflow] : []));
  return Object.fromEntries([...coreWorkflowDefinitions, ...declared].map((def) => [def.entityType, def]));
}
