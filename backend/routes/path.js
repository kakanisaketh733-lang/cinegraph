const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/neo4j');

// GET /api/path?from=NAME&to=NAME - shortest ACTED_IN path between two people
router.get('/path', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query params are required' });
    }

    const existCheck = await runQuery(
      `MATCH (a:Person {name: $from}) RETURN a.name AS name
       UNION
       MATCH (b:Person {name: $to}) RETURN b.name AS name`,
      { from, to }
    );
    const foundNames = new Set(existCheck.map(r => r.get('name')));
    if (!foundNames.has(from) || !foundNames.has(to)) {
      return res.status(404).json({ error: 'One or both people not found' });
    }

    const cypher = `
      MATCH (a:Person {name: $from}), (b:Person {name: $to})
      OPTIONAL MATCH path = shortestPath((a)-[:ACTED_IN*..12]-(b))
      RETURN path
    `;
    const records = await runQuery(cypher, { from, to });
    const pathValue = records[0].get('path');

    if (!pathValue) {
      return res.json({ found: false, degrees: null, chain: [] });
    }

    // Walk the path's segments to build an alternating Person -> Movie -> Person chain.
    const chain = [];
    pathValue.segments.forEach((seg, i) => {
      if (i === 0) {
        chain.push({
          type: seg.start.labels[0],
          name: seg.start.properties.name || seg.start.properties.title
        });
      }
      chain.push({
        type: seg.end.labels[0],
        name: seg.end.properties.name || seg.end.properties.title
      });
    });

    const degrees = chain.filter(n => n.type === 'Person').length - 1;

    res.json({ found: true, degrees, chain });
  } catch (err) { next(err); }
});

module.exports = router;
