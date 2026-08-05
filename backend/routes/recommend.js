// routes/recommend.js
// Two-hop traversal: person -> ACTED_IN -> movie -> IN_GENRE -> genre
// -> IN_GENRE -> other movie, excluding movies the person is already in.
// This is the same shape a relational join could express, but it stays
// readable here because we never write the join condition by hand -
// the graph pattern *is* the query.

const express = require('express');
const { runQuery, toNative } = require('../db');

const router = express.Router();

// GET /api/recommend/:name  -> movies to recommend to an actor,
// based on the genres of movies they've already been in.
router.get('/recommend/:name', async (req, res, next) => {
  try {
const cypher = `
MATCH (p:Person {name: $name})-[:ACTED_IN]->(seen:Movie)-[:IN_GENRE]->(g:Genre)
MATCH (rec:Movie)-[:IN_GENRE]->(g)
WHERE NOT (p)-[:ACTED_IN]->(rec)
OPTIONAL MATCH (d:Person)-[:DIRECTED]->(rec)
WITH DISTINCT rec,
     collect(DISTINCT g.name) AS sharedGenres,
     d
RETURN
    rec.title AS title,
    rec.year AS year,
    d.name AS director,
    sharedGenres,
    size(sharedGenres) AS score
ORDER BY score DESC, rec.year DESC
LIMIT 12
`;
    const records = await runQuery(cypher, { name: req.params.name });
    if (records.length === 0) {
      // Distinguish "person doesn't exist" from "no recommendations".
      const exists = await runQuery('MATCH (p:Person {name: $name}) RETURN p LIMIT 1', {
        name: req.params.name,
      });
      if (exists.length === 0) return res.status(404).json({ error: 'Person not found' });
    }
    const recommendations = records.map((r) => ({
      title: r.get('title'),
      year: toNative(r.get('year')),
      director: r.get('director'),
      sharedGenres: r.get('sharedGenres'),
      score: toNative(r.get('score')),
    }));
    res.json({ person: req.params.name, recommendations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
