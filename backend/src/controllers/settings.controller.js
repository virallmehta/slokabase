import { settingsRepository, castValue } from '#services/settingsRepository.js';
import { sendEmail, getEmailConfig } from '#services/emailService.js';
import { userRepository } from '#services/userRepository.js';
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

// Keys whose value is a secret — never echoed back once set, in any
// listing response, regardless of who's asking (this repo's `demo` role
// holds settings:read, so "gated on settings:read" alone isn't enough to
// treat a value as safe to display). A blank value on reload does not
// mean "not configured" for these keys — see db/seeds/02_settings.js.
const SENSITIVE_KEYS = new Set(['smtp_password']);

// Per-key validation beyond the generic type check above — extend this
// map rather than special-casing updateSetting itself for a new key.
const EXTRA_VALIDATORS = {
  smtp_port: (value) => {
    if (value === 0) return null; // 0 = "unset, fall back to EMAIL_PORT"
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      return '"smtp_port" must be a valid port number (1-65535), or 0 to use the .env default';
    }
    return null;
  },
  smtp_from: (value) => {
    if (!value) return null; // blank = "unset, fall back to EMAIL_FROM"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return '"smtp_from" must be a valid email address';
    }
    return null;
  },
};

function toPublicSetting(setting) {
  return SENSITIVE_KEYS.has(setting.key) ? { ...setting, value: '' } : setting;
}

export const listSettings = asyncHandler(async (req, res) => {
  const settings = await settingsRepository.getAll();
  res.json({ groups: groupByCategory(settings.map(toPublicSetting)) });
});

// Non-admin-gated: exposes exactly the one setting that legitimately
// needs to reach every authenticated user's UI (sidebar name, page
// title) without requiring settings:manage. Never add another field here
// without checking it's actually meant to be public — see
// backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant"
// section.
export const getPublicSettings = asyncHandler(async (req, res) => {
  const appName = await settingsRepository.get('app_name');
  res.json({ appName });
});

export const updateSetting = asyncHandler(async (req, res) => {
  const existing = await settingsRepository.findRaw(req.params.key);
  if (!existing) throw ApiError.notFound('Setting not found');

  if (!typeMatches(existing.type, req.body.value)) {
    throw ApiError.badRequest(`"${req.params.key}" expects a value of type "${existing.type}"`);
  }

  const extraError = EXTRA_VALIDATORS[req.params.key]?.(req.body.value);
  if (extraError) throw ApiError.badRequest(extraError);

  // Never log a secret's actual value, old or new (same rule as password
  // changes elsewhere — see backend/CLAUDE.md's audit logging section),
  // but still record THAT it changed — a silently-skipped audit entry
  // would mean no trace at all of who touched a credential and when.
  const changes = SENSITIVE_KEYS.has(req.params.key)
    ? { value: { from: '(hidden)', to: '(hidden)' } }
    : { value: { from: castValue(existing), to: req.body.value } };
  const value = await settingsRepository.set(req.params.key, req.body.value, {
    actorId: req.user.id,
    changes,
  });
  res.json({ setting: toPublicSetting({ ...existing, value }) });
});

// Sends a real email through the merged SMTP config (DB settings over
// EMAIL_* env vars — see emailService.js's getEmailConfig()) to the
// caller's own address, so an admin can verify SMTP settings actually
// work without needing to check server logs or a real inbox belonging to
// someone else.
export const sendTestEmail = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  const emailConfig = await getEmailConfig();

  try {
    await sendEmail({
      to: user.email,
      subject: 'Test email from your Slokabase settings',
      text: `This is a test email sent from the SMTP settings you've configured (host: ${emailConfig.host}, port: ${emailConfig.port}). If you received this, your configuration works.`,
      html: `<p>This is a test email sent from the SMTP settings you've configured (host: <code>${emailConfig.host}</code>, port: <code>${emailConfig.port}</code>). If you received this, your configuration works.</p>`,
    });
  } catch (error) {
    throw ApiError.badRequest(`Couldn't send a test email: ${error.message}`);
  }

  res.json({ message: `Test email sent to ${user.email}.` });
});
