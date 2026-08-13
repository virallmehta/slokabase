import { db } from '#db/knex.js';
import { createAuditedRepository } from '#services/auditedRepository.js';

const audited = createAuditedRepository('app_settings', 'setting', { idColumn: 'key' });

// `value` is always stored as text; `type` says how to cast it back out.
// Exported so the controller can validate an incoming value against a
// setting's existing type before writing (see controller.js's updateSetting).
export function castValue(row) {
  switch (row.type) {
    case 'number':
      return Number(row.value);
    case 'boolean':
      return row.value === 'true';
    case 'json':
      return JSON.parse(row.value);
    default:
      return row.value;
  }
}

function serializeValue(type, value) {
  if (type === 'json') return JSON.stringify(value);
  return String(value);
}

// Settings are read on practically every request that renders anything
// settings-driven, but change rarely (an admin editing one in a form) —
// a simple in-memory cache, invalidated on every write, avoids hitting
// the DB for something this static. `null` means "not loaded yet";
// distinct from an empty array (a real, if unlikely, empty settings table).
let cache = null;

async function loadAll() {
  if (cache === null) {
    cache = await db('app_settings').select('*').orderBy('key');
  }
  return cache;
}

function invalidateCache() {
  cache = null;
}

export const settingsRepository = {
  getAll: async () => {
    const rows = await loadAll();
    return rows.map((row) => ({ ...row, value: castValue(row) }));
  },

  get: async (key) => {
    const rows = await loadAll();
    const row = rows.find((r) => r.key === key);
    return row ? castValue(row) : undefined;
  },

  // Raw row (uncast value, still text) — the controller needs `type` to
  // validate the incoming value before calling set().
  findRaw: async (key) => {
    const rows = await loadAll();
    return rows.find((r) => r.key === key);
  },

  set: async (key, value, { actorId, changes } = {}) => {
    const existing = await settingsRepository.findRaw(key);
    if (!existing) return null;

    await audited.update(
      key,
      { value: serializeValue(existing.type, value), updated_by: actorId ?? null },
      { actorId, changes }
    );
    invalidateCache();

    return settingsRepository.get(key);
  },

  // Test-only escape hatch — production code never needs to force a
  // reload, since every write already invalidates the cache itself.
  _invalidateCacheForTests: invalidateCache,
};
