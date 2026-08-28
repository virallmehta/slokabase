import { approvalRepository } from './repository.js';
import { assertValidTransition, availableTransitions } from '#services/workflowService.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

export const listApprovals = asyncHandler(async (req, res) => {
  const approvals = await approvalRepository.findAll();
  res.json({ approvals });
});

export const getApproval = asyncHandler(async (req, res) => {
  const approval = await approvalRepository.findById(req.params.id);
  if (!approval) throw ApiError.notFound('Approval not found');
  res.json({ approval });
});

export const createApproval = asyncHandler(async (req, res) => {
  const approval = await approvalRepository.create(req.body, { actorId: req.user.id });
  res.status(201).json({ approval });
});

export const transitionApproval = asyncHandler(async (req, res) => {
  const approval = await approvalRepository.findById(req.params.id);
  if (!approval) throw ApiError.notFound('Approval not found');

  assertValidTransition('example-approval', approval.state, req.body.to, req.user);

  const updated = await approvalRepository.transition(approval.id, req.body.to, { actorId: req.user.id });
  res.json({ approval: updated });
});

export const listAvailableTransitions = asyncHandler(async (req, res) => {
  const approval = await approvalRepository.findById(req.params.id);
  if (!approval) throw ApiError.notFound('Approval not found');

  const transitions = availableTransitions('example-approval', approval.state, req.user);
  res.json({ transitions });
});
