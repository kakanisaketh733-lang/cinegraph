const express = require('express');
const router = express.Router();
const { verifyConnection } = require('../db/neo4j');

// GET /api/health - reports whether CognoDB is reachable right now
router.get('/health', async (req, res) => {
  const status = await verifyConnection();
  res.json({
    status: status.connected ? 'ok' : 'db_unreachable',
    database: status.connected,
    error: status.error,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
