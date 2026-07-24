import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from '#config/env.js';
import { errorHandler, notFoundHandler } from '#middleware/errorHandler.js';
import { asyncHandler } from '#utils/asyncHandler.js';

import { db } from './db/knex.js'; 

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

// Setup a quick local test table inside dev.sqlite3
async function initTestDatabase() {
  const hasTable = await db.schema.hasTable('leads');
  if (!hasTable) {
    await db.schema.createTable('leads', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.timestamps(true, true);
    });
    console.log(`🏁 SQLite table "leads" initialized inside ${config.db.sqliteFilename}`);
    
    // Insert a test seed
    await db('leads').insert({ name: 'Viral Mehta', email: 'viral@example.com' });
  }
}
initTestDatabase().catch(err => console.error('❌ Table init error:', err))


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

// 2. Example: An asynchronous route using the wrapper
app.get('/test-async', asyncHandler(async (req, res) => {
    // Simulating an asynchronous action like fetching a user from a database
    const fakeDbQuery = () => new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timeout!")), 500));
    
    await fakeDbQuery(); 
    
    res.json({ message: "This won't execute because the promise rejects above." });
}));


// Fetch all entries from your local SQLite table
app.get('/leads', asyncHandler(async (req, res) => {
    const leads = await db('leads').select('*');
    res.json({ success: true, data: leads });
}));

// Insert a new lead into your local SQLite table
app.post('/leads', asyncHandler(async (req, res) => {
    const { name, email } = req.body;
    const [newId] = await db('leads').insert({ name, email });
    res.status(201).json({ success: true, id: newId, message: 'Lead added!' });
}));

// --- ERROR HANDLERS (Must be at the very bottom) ---
// 2. Catch 404s for any route that doesn't exist
app.use(notFoundHandler);

// 3. Catch all operational/system errors thrown via next(err)
app.use(errorHandler);