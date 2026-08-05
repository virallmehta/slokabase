import { auditLogRepository } from '#services/auditLogRepository.js';
import { asyncHandler } from '#utils/asyncHandler.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { search, actorId, entityType, action, dateFrom, dateTo, page, limit } = req.query;
  const result = await auditLogRepository.listAll({
    search,
    actorId,
    entityType,
    action,
    dateFrom,
    dateTo,
    page,
    limit,
  });
  res.json(result);
});

// Populates the Module/Action filter dropdowns with whatever values have
// actually been logged — see auditLogRepository.js's comment on why this
// isn't a hardcoded list.
export const getFilterOptions = asyncHandler(async (req, res) => {
  const [entityTypes, actions] = await Promise.all([
    auditLogRepository.listDistinctEntityTypes(),
    auditLogRepository.listDistinctActions(),
  ]);
  res.json({ entityTypes: entityTypes.sort(), actions: actions.sort() });
});
