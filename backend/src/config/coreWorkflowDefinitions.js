/**
 * Static workflow state machines for core, mandatory infrastructure — none
 * yet. Mirrors src/config/coreMenu.js's role for menu entries: a future
 * core entity with its own approval/status lifecycle (not an optional
 * module) declares its { entityType, states, transitions } here instead of
 * under modules/, the same way coreMenuItems holds core menu entries
 * outside the module registry loop.
 */
export const coreWorkflowDefinitions = [];
