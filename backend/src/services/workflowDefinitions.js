import modules from '#modules/index.js';
import { coreWorkflowDefinitions } from '#config/coreWorkflowDefinitions.js';

/**
 * Deferred, not computed at import time. This module is itself imported,
 * transitively, by module controllers/validators that #modules/index.js
 * loads while building the registry (a module can use workflowService in
 * its own routes) — reading the `modules` binding at top level here would
 * race index.js's own top-level await and throw "Cannot access 'modules'
 * before initialization". Calling getWorkflowDefinitions() only happens at
 * request/test time, after the registry has fully loaded, so the read is
 * always safe by then.
 */
export function getWorkflowDefinitions() {
  const declared = modules.flatMap((mod) => (mod.workflow ? [mod.workflow] : []));
  return Object.fromEntries([...coreWorkflowDefinitions, ...declared].map((def) => [def.entityType, def]));
}
