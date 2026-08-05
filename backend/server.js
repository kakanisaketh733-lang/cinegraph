// server.js
// Express app: serves the JSON API and the static frontend from one
// process, so the whole thing deploys as a single web service.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { verifyConnection, closeDriver } = require('./db');

const explore = require('./routes/explore');
const recommend = require('./routes/recommend');
const pathRoutes = require('./routes/path');
const collaborators = require('./routes/collaborators');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check - also reports live DB connectivity, which is useful
// both for your own debugging and for uptime monitors.
app.get('/api/health', async (req, res) => {
  const status = await verifyConnection();
  res.status(status.ok ? 200 : 503).json({
    api: 'ok',
    database: status.ok ? 'connected' : 'unreachable',
    error: status.ok ? undefined : status.error,
  });
});

app.use('/api', explore);
app.use('/api', recommend);
app.use('/api', pathRoutes);
app.use('/api', collaborators);

// Serve the static frontend (vanilla HTML/CSS/JS - no build step).
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Centralized error handler. If the database is unreachable, every
// route above calls next(err) via its catch block and lands here -
// the user gets a clear message instead of a raw stack trace or a
// hung request.
app.use((err, req, res, next) => {
  console.error(err);
  const isConnectionIssue = /connect|auth|Neo4jError|ServiceUnavailable/i.test(err.message || '');
  res.status(isConnectionIssue ? 503 : 500).json({
    error: isConnectionIssue
      ? 'Could not reach the database. Check your CognoDB credentials and that the instance is running.'
      : 'Something went wrong handling that request.',
    detail: err.message,
  });
});

async function start() {
  const status = await verifyConnection();
  if (status.ok) {
    console.log('Connected to CognoDB.');
  } else {
    console.warn('Warning: could not connect to CognoDB at startup:', status.error);
    console.warn('The server will still start, but API requests will return 503 until the database is reachable.');
  }

  app.listen(PORT, () => {
    console.log(`CineGraph server listening on http://localhost:${PORT}`);
  });
}

process.on('SIGTERM', async () => {
  await closeDriver();
  process.exit(0);
});

start();
