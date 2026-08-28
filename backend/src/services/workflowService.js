import { ApiError } from '#utils/ApiError.js';
import { getWorkflowDefinitions } from './workflowDefinitions.js';

function matchingTransitions(entityType, currentState) {
  const definition = getWorkflowDefinitions()[entityType];
  if (!definition) return [];
  return definition.transitions.filter((t) => t.from === currentState);
}

export function assertValidTransition(entityType, currentState, newState, actor) {
  const transition = matchingTransitions(entityType, currentState).find((t) => t.to === newState);
  if (!transition) throw ApiError.badRequest('Invalid transition');
  if (!actor.permissions.includes(transition.permission)) {
    throw ApiError.forbidden('You do not have permission to perform this action');
  }
}

export function isValidState(entityType, state) {
  const definition = getWorkflowDefinitions()[entityType];
  return Boolean(definition && definition.states.includes(state));
}

export function availableTransitions(entityType, currentState, actor) {
  return matchingTransitions(entityType, currentState)
    .filter((t) => actor.permissions.includes(t.permission))
    .map((t) => t.to);
}
