require('dotenv').config();
const path = require('path');
const express = require('express');
const { verifyConnection, closeDriver } = require('./db/neo4j');

const healthRoute = require('./routes/health');
const exploreRoute = require('./routes/explore');
const recommendRoute = require('./routes/recommend');
const pathRoute = require('./routes/path');
const collaboratorsRoute = require('./routes/collaborators');
const companyRoute = require('./routes/company');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(express.json());

app.use('/api', healthRoute);
app.use('/api', exploreRoute);
app.use('/api', recommendRoute);
app.use('/api', pathRoute);
app.use('/api', collaboratorsRoute);
app.use('/api', companyRoute);

// Unmatched /api/* routes get a JSON 404 instead of falling through to the SPA shell.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(FRONTEND_DIR));

// Anything else falls through to the SPA shell.
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Centralized error handler - every route above forwards errors via next(err).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  const status = await verifyConnection();
  if (!status.connected) {
    console.warn('⚠️  Could not reach CognoDB:', status.error);
    console.warn('   The server is starting anyway. Check /api/health once it is up,');
    console.warn('   and confirm backend/.env has the right COGNODB_* values.');
  } else {
    console.log('✅ Connected to CognoDB');
  }

  app.listen(PORT, () => {
    console.log(`CineGraph running at http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});

start();
