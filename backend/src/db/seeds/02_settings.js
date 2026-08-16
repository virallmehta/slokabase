/**
 * Starter settings for a fresh install — generic to this boilerplate, not
 * specific to any one deployment. Adding another setting later is just
 * another row here (plus a matching entry in the frontend form), never a
 * migration.
 *
 * Only settings something in the app actually reads belong here — see
 * backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant"
 * section for the rule. `app_name` is read by GET /api/v1/settings/public
 * (src/controllers/settings.controller.js) and the welcome email
 * (user.controller.js); the `smtp_*` settings are read by
 * emailService.js's getEmailConfig(), merged over the EMAIL_* env vars
 * (DB value wins when non-empty/non-zero, env is the fallback — see
 * emailService.js for the exact merge). Pagination defaults and timezone
 * display are NOT settings — see src/config/constants.js and
 * frontend/src/constants/pagination.ts.
 *
 * The smtp_* string/number fields seed blank/zero on purpose (not
 * pre-filled from the current .env) — blank IS the "use the environment
 * variable" state, not a placeholder waiting to be filled in.
 * smtp_password is additionally never echoed back once set (see
 * settings.controller.js's listSettings) — a blank field on reload does
 * not mean "no password configured".
 *
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  const settings = [
    {
      key: 'app_name',
      value: 'Slokabase',
      type: 'string',
      category: 'General',
      description: 'Name shown in the sidebar, page title, and account emails.',
    },
    {
      key: 'smtp_host',
      value: '',
      type: 'string',
      category: 'Email',
      description: 'SMTP server host. Leave blank to use the EMAIL_HOST environment variable.',
    },
    {
      key: 'smtp_port',
      value: '0',
      type: 'number',
      category: 'Email',
      description: 'SMTP server port. Leave as 0 to use the EMAIL_PORT environment variable.',
    },
    {
      key: 'smtp_secure',
      // No "unset" state for a boolean — seeded from the env-configured
      // behavior at install time, then the DB row is authoritative from
      // that point on (see emailService.js's getEmailConfig()).
      value: process.env.EMAIL_SECURE === 'true' ? 'true' : 'false',
      type: 'boolean',
      category: 'Email',
      description: 'Use TLS/SSL when connecting to the SMTP server.',
    },
    {
      key: 'smtp_username',
      value: '',
      type: 'string',
      category: 'Email',
      description: 'SMTP username. Leave blank to use the EMAIL_USER environment variable.',
    },
    {
      key: 'smtp_password',
      value: '',
      type: 'string',
      category: 'Email',
      description:
        'SMTP password. Leave blank to use the EMAIL_PASSWORD environment variable — never shown again once set.',
    },
    {
      key: 'smtp_from',
      value: '',
      type: 'string',
      category: 'Email',
      description: 'From address for outgoing email. Leave blank to use the EMAIL_FROM environment variable.',
    },
  ];

  for (const setting of settings) {
    const existing = await knex('app_settings').where({ key: setting.key }).first();
    if (!existing) await knex('app_settings').insert(setting);
  }
}
