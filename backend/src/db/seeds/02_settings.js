/**
 * Starter settings for a fresh install — generic to this boilerplate, not
 * specific to any one deployment. Adding another setting later is just
 * another row here (plus a matching entry in the frontend form), never a
 * migration.
 *
 * Only settings something in the app actually reads belong here — see
 * backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant"
 * section for the rule. `app_name` and `support_email` are read by
 * GET /api/v1/settings/public (src/controllers/settings.controller.js);
 * pagination defaults and timezone display are NOT settings — see
 * src/config/constants.js and frontend/src/constants/pagination.ts.
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
      key: 'support_email',
      value: 'support@example.com',
      type: 'string',
      category: 'General',
      description: 'Contact address shown to users who need help.',
    },
  ];

  for (const setting of settings) {
    const existing = await knex('app_settings').where({ key: setting.key }).first();
    if (!existing) await knex('app_settings').insert(setting);
  }
}
