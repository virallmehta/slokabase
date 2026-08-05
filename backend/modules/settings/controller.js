import { settingsRepository, castValue } from './repository.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

// Groups the flat settings table by its `category` column — grouping is
// data-driven (whatever the seed assigns), not a hardcoded list, so a new
// category just needs a seed row, no code change here.
function groupByCategory(settings) {
  const groups = new Map();
  for (const setting of settings) {
    if (!groups.has(setting.category)) groups.set(setting.category, { category: setting.category, settings: [] });
    groups.get(setting.category).settings.push(setting);
  }
  return [...groups.values()].sort((a, b) => a.category.localeCompare(b.category));
}

function typeMatches(type, value) {
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'json') return typeof value === 'object' && value !== null;
  return typeof value === 'string';
}

export const listSettings = asyncHandler(async (req, res) => {
  const settings = await settingsRepository.getAll();
  res.json({ groups: groupByCategory(settings) });
});

export const updateSetting = asyncHandler(async (req, res) => {
  const existing = await settingsRepository.findRaw(req.params.key);
  if (!existing) throw ApiError.notFound('Setting not found');

  if (!typeMatches(existing.type, req.body.value)) {
    throw ApiError.badRequest(`"${req.params.key}" expects a value of type "${existing.type}"`);
  }

  const changes = { value: { from: castValue(existing), to: req.body.value } };
  const value = await settingsRepository.set(req.params.key, req.body.value, {
    actorId: req.user.id,
    changes,
  });
  res.json({ setting: { ...existing, value } });
});
