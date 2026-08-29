import { describe, it, expect, afterAll } from 'vitest';
import { db } from '#db/knex.js';
import { assertValidTransition, isValidState, availableTransitions } from '#services/workflowService.js';
// Populates the workflow registry via setModules() as a side effect — see
// workflowDefinitions.js's header comment. Without this, getWorkflowDefinitions()
// returns {} and every 'example-approval' assertion below would fail.
import '#modules/index.js';

describe('workflowService (backend/src/services/workflowService.js)', () => {
  afterAll(async () => {
    await db.destroy();
  });

  const admin = { permissions: ['example-approvals:read', 'example-approvals:write', 'example-approvals:approve'] };
  const writer = { permissions: ['example-approvals:read', 'example-approvals:write'] };
  const reader = { permissions: ['example-approvals:read'] };

  it('allows a valid transition when the actor holds the required permission', () => {
    expect(() => assertValidTransition('example-approval', 'draft', 'submitted', writer)).not.toThrow();
  });

  it('rejects a transition not declared for the current state', () => {
    expect(() => assertValidTransition('example-approval', 'draft', 'approved', admin)).toThrow('Invalid transition');
  });

  it('rejects a valid transition when the actor lacks the required permission', () => {
    expect(() => assertValidTransition('example-approval', 'submitted', 'approved', writer)).toThrow(
      'You do not have permission to perform this action'
    );
  });

  it('isValidState is true for a declared state and false otherwise', () => {
    expect(isValidState('example-approval', 'submitted')).toBe(true);
    expect(isValidState('example-approval', 'archived')).toBe(false);
    expect(isValidState('not-a-real-entity', 'draft')).toBe(false);
  });

  it('availableTransitions filters to only what the actor is permitted to do', () => {
    expect(availableTransitions('example-approval', 'draft', reader)).toEqual([]);
    expect(availableTransitions('example-approval', 'draft', writer)).toEqual(['submitted']);
    expect(availableTransitions('example-approval', 'submitted', writer)).toEqual(['draft']);
    expect(availableTransitions('example-approval', 'submitted', admin).sort()).toEqual(['approved', 'draft', 'rejected']);
  });
});
