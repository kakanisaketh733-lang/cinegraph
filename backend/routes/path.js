// routes/path.js
// "Six Degrees" style shortest path between two people, hopping through
// shared movies. Variable-length, unknown-hop-count shortest-path queries
// like this are exactly the kind of thing a relational database is
// awkward at: in SQL you'd need a recursive CTE re-joining the same
// tables at every depth, with no guarantee of finding the *shortest*
// path without extra bookkeeping. In Cypher it's one line.

const express = require('express');
const { runQuery, toNative } = require('../db');

const router = express.Router();

// GET /api/path?from=Tom%20Hanks&to=Christian%20Bale
router.get('/path', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query params are required' });
    }

    const cypher = `
      MATCH (a:Person {name: $from}), (b:Person {name: $to})
      MATCH path = shortestPath((a)-[:ACTED_IN*..12]-(b))
      RETURN path
    `;
    const records = await runQuery(cypher, { from, to });

    if (records.length === 0) {
      const bothExist = await runQuery(
        `MATCH (a:Person {name: $from}) MATCH (b:Person {name: $to}) RETURN a, b`,
        { from, to }
      );
      if (bothExist.length === 0) {
        return res.status(404).json({ error: 'One or both people were not found in the graph' });
      }
      return res.json({ from, to, connected: false, hops: [] });
    }

    const pathValue = records[0].get('path');
    const segments = toNative(pathValue);

    // Flatten alternating Person -> Movie -> Person -> ... into a simple
    // ordered list the frontend can render as a chain.
    const chain = [];
    segments.forEach((seg, i) => {
      if (i === 0) chain.push({ type: seg.start.labels[0], name: seg.start.name || seg.start.title });
      chain.push({ type: seg.end.labels[0], name: seg.end.name || seg.end.title });
    });

    res.json({
      from,
      to,
      connected: true,
      degrees: Math.floor(chain.length / 2),
      chain,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
