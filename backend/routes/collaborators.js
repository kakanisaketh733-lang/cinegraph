const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/neo4j');

const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : v);

// GET /api/collaborators/:name - people who share a co-star with :name
// but have never actually appeared in a film together directly.
router.get('/collaborators/:name', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (a:Person {name: $name})-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(mutual:Person)
            -[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b:Person)
      WHERE a <> b
        AND NOT (a)-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b)
      RETURN b.name AS name, count(DISTINCT mutual) AS sharedCoStars, collect(DISTINCT mutual.name) AS via
      ORDER BY sharedCoStars DESC, b.name ASC
      LIMIT 10
    `;
    const records = await runQuery(cypher, { name: req.params.name });

    if (!records.length) {
      const exists = await runQuery('MATCH (p:Person {name: $name}) RETURN p.name AS name', { name: req.params.name });
      if (!exists.length) {
        return res.status(404).json({ error: 'Person not found' });
      }
    }

    res.json(records.map(r => ({
      name: r.get('name'),
      sharedCoStars: toNum(r.get('sharedCoStars')),
      via: r.get('via')
    })));
  } catch (err) { next(err); }
});

module.exports = router;
