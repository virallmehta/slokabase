import { db } from '#db/knex.js';
import { createAuditedRepository } from '#services/auditedRepository.js';

const audited = createAuditedRepository('example_approvals', 'example-approvals');

export const approvalRepository = {
  findAll: () => db('example_approvals').select('*').orderBy('id'),

  findById: (id) => db('example_approvals').where({ id }).first(),

  create: async ({ title }, { actorId } = {}) => {
    const id = await audited.insert({ title, state: 'draft' }, { actorId, changes: { title, state: 'draft' } });
    return approvalRepository.findById(id);
  },

  transition: async (id, newState, { actorId } = {}) => {
    await audited.update(id, { state: newState }, { actorId, changes: { state: newState } });
    return approvalRepository.findById(id);
  },
};
