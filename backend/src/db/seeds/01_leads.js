/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Deletes ALL existing entries
  await knex('leads').del()
  await knex('leads').insert([
    { name: 'Viral Mehta', email: 'viral@example.com' },
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Anjali Sharma', email: 'anjali@example.com' }
  ]);
};
