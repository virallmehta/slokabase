/**
 * Starter settings for a fresh install — generic to this boilerplate, not
 * specific to any one deployment. Adding another setting later is just
 * another row here (plus a matching entry in the frontend form), never a
 * migration.
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
      description: 'Name shown in the app header and page titles.',
    },
    {
      key: 'support_email',
      value: 'support@example.com',
      type: 'string',
      category: 'General',
      description: 'Contact address shown to users who need help.',
    },
    {
      key: 'default_timezone',
      value: 'UTC',
      type: 'string',
      category: 'General',
      description: 'Timezone used for displaying dates until a user sets their own.',
    },
    {
      key: 'items_per_page_default',
      value: '25',
      type: 'number',
      category: 'General',
      description: 'Default "rows per page" for admin list views.',
    },
  ];

  for (const setting of settings) {
    const existing = await knex('app_settings').where({ key: setting.key }).first();
    if (!existing) await knex('app_settings').insert(setting);
  }
}
