const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/neo4j');

const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : v);

// GET /api/company?director=&minCollaborations= - which actors does each
// director keep casting? (aggregation over a 2-hop DIRECTED/ACTED_IN pattern)
router.get('/company', async (req, res, next) => {
  try {
    const { director = '' } = req.query;
    const min = req.query.minCollaborations ? parseInt(req.query.minCollaborations, 10) : 2;

    const cypher = `
      MATCH (d:Person)-[:DIRECTED]->(m:Movie)<-[:ACTED_IN]-(a:Person)
      WHERE $director = '' OR d.name = $director
      WITH d, a, count(DISTINCT m) AS collaborations, collect(DISTINCT m.title) AS movies
      WHERE collaborations >= $min
      RETURN d.name AS director, a.name AS actor, collaborations, movies
      ORDER BY d.name ASC, collaborations DESC
    `;
    const records = await runQuery(cypher, { director, min });
    res.json(records.map(r => ({
      director: r.get('director'),
      actor: r.get('actor'),
      collaborations: toNum(r.get('collaborations')),
      movies: r.get('movies')
    })));
  } catch (err) { next(err); }
});

module.exports = router;
