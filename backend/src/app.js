import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from '#config/env.js';
import { errorHandler, notFoundHandler } from '#middleware/errorHandler.js';
import { enforcePasswordChange } from '#middleware/enforcePasswordChange.js';
import { asyncHandler } from '#utils/asyncHandler.js';

import { db } from './db/knex.js'; 

import authRouter from '#routes/auth.routes.js';
import leadsRouter from '#routes/lead.routes.js';
import userRouter from '#routes/user.routes.js';
import { roleRouter, roleAdminRouter } from '#routes/role.routes.js';
import menuRouter from '#routes/menu.routes.js';
import modules from '#modules/index.js';

// 1. Initialize the express application instance
export const app = express(); 

if (config.isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true, // required so the browser sends/receives cookies cross-origin
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(enforcePasswordChange);

app.get('/', (req, res) => {
    
    console.log(req.headers);
    res.send('Hello World');
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// app.get('/test-error', (req, res, next) => {
//     const err = new Error('Database connection failed!');
//     err.status = 500;
//     next(err); // This sends it straight to errorHandler
// });




app.use('/api/v1/auth', authRouter);
// 2. Mount your feature routes under a clean api namespace
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/roles', roleRouter);
app.use('/api/v1/admin/roles', roleAdminRouter);
app.use('/api/menu', menuRouter);

// Feature modules (backend/modules/<name>/) are mounted here in one loop
// rather than one-by-one — see modules/index.js for how they're discovered.
for (const mod of modules) {
  app.use(mod.basePath, mod.routes);
}

// --- ERROR HANDLERS (Must be at the very bottom) ---
// 2. Catch 404s for any route that doesn't exist
app.use(notFoundHandler);

// 3. Catch all operational/system errors thrown via next(err)
app.use(errorHandler);