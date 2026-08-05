const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/neo4j');

const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : v);

// GET /api/recommend/:name - movies recommended for a person based on
// genre overlap with films they've already acted in (2-hop traversal).
router.get('/recommend/:name', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (p:Person {name: $name})-[:ACTED_IN]->(seen:Movie)-[:IN_GENRE]->(g:Genre)
      MATCH (g)<-[:IN_GENRE]-(rec:Movie)
      WHERE NOT (p)-[:ACTED_IN]->(rec)
      WITH rec, count(DISTINCT g) AS score, collect(DISTINCT g.name) AS sharedGenres
      RETURN rec.title AS title, rec.year AS year, score, sharedGenres
      ORDER BY score DESC, rec.year DESC
      LIMIT 10
    `;
    const records = await runQuery(cypher, { name: req.params.name });

    if (!records.length) {
      const exists = await runQuery('MATCH (p:Person {name: $name}) RETURN p.name AS name', { name: req.params.name });
      if (!exists.length) {
        return res.status(404).json({ error: 'Person not found' });
      }
      // Person exists but has no acting credits (director-only) or no recs — empty list is a valid answer.
    }

    res.json(records.map(r => ({
      title: r.get('title'),
      year: toNum(r.get('year')),
      score: toNum(r.get('score')),
      sharedGenres: r.get('sharedGenres')
    })));
  } catch (err) { next(err); }
});

module.exports = router;
