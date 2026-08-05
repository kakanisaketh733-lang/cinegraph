// routes/collaborators.js
// Two graph-native insight queries:
//
// 1. Hidden co-stars: pairs of actors who share several mutual co-stars
//    but have never actually appeared in a movie together themselves.
//    ("You two clearly run in the same circles - how have you never
//    worked together?")
//
// 2. Frequent collaborators: director/actor pairs who work together
//    repeatedly - a director's "regular company."
//
// Both require walking two or three relationships deep and comparing
// sets of neighbors, which is where graph traversal earns its keep.

const express = require('express');
const { runQuery, toNative } = require('../db');

const router = express.Router();

// GET /api/hidden-costars/:name
router.get('/hidden-costars/:name', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (a:Person {name: $name})-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(mutual:Person)
            -[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b:Person)
      WHERE a <> b
        AND NOT (a)-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b)
      WITH b, count(DISTINCT mutual) AS sharedCoStars, collect(DISTINCT mutual.name) AS via
      WHERE sharedCoStars >= 2
      RETURN b.name AS name, sharedCoStars, via
      ORDER BY sharedCoStars DESC
      LIMIT 10
    `;
    const records = await runQuery(cypher, { name: req.params.name });
    res.json({
      person: req.params.name,
      hiddenCostars: records.map((r) => ({
        name: r.get('name'),
        sharedCoStars: toNative(r.get('sharedCoStars')),
        via: r.get('via'),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/collaborators - global list of the most frequent director/actor pairs
router.get('/collaborators', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (d:Person)-[:DIRECTED]->(m:Movie)<-[:ACTED_IN]-(a:Person)
      WITH d, a, count(m) AS collaborations, collect(m.title) AS movies
      WHERE collaborations >= 2
      RETURN d.name AS director, a.name AS actor, collaborations, movies
      ORDER BY collaborations DESC
      LIMIT 15
    `;
    const records = await runQuery(cypher);
    res.json({
      collaborators: records.map((r) => ({
        director: r.get('director'),
        actor: r.get('actor'),
        collaborations: toNative(r.get('collaborations')),
        movies: r.get('movies'),
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
