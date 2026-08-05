import { app } from './app.js';
import { config } from '#config/env.js';
import { syncModulePermissions } from '#modules/syncPermissions.js';

// Access variables like this:
console.log(config.port);
console.log(config.nodeEnv);

await syncModulePermissions();

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});
