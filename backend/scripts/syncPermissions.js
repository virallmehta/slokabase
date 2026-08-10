import { db } from '#db/knex.js';
import { syncModulePermissions } from '#modules/syncPermissions.js';

/**
 * One-off CLI for syncModulePermissions() (see modules/syncPermissions.js).
 * src/server.js still calls this automatically on startup for traditional
 * hosting (DigitalOcean, Render), but api/index.js (the Vercel serverless
 * entry point) imports src/app.js directly and skips it — so on Vercel this
 * needs to be run by hand after deploying a new/changed module, against
 * whichever DB the env vars point at, same way `npm run migrate` is run
 * manually against Neon.
 */
await syncModulePermissions();
await db.destroy();
