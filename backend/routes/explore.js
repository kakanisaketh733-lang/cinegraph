const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/neo4j');

const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : v);

// GET /api/movies?search=&genre= - list movies, optionally filtered
router.get('/movies', async (req, res, next) => {
  try {
    const { search = '', genre = '' } = req.query;
    const cypher = `
      MATCH (m:Movie)
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      OPTIONAL MATCH (d:Person)-[:DIRECTED]->(m)
      WITH m, collect(DISTINCT g.name) AS genres, collect(DISTINCT d.name) AS directors
      WHERE ($search = '' OR toLower(m.title) CONTAINS toLower($search))
        AND ($genre = '' OR $genre IN genres)
      RETURN m.title AS title, m.year AS year, genres, directors
      ORDER BY m.year DESC
    `;
    const records = await runQuery(cypher, { search, genre });
    res.json(records.map(r => ({
      title: r.get('title'),
      year: toNum(r.get('year')),
      genres: r.get('genres').filter(Boolean),
      directors: r.get('directors').filter(Boolean)
    })));
  } catch (err) { next(err); }
});

// GET /api/movies/:title - single movie with full cast/crew
router.get('/movies/:title', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (m:Movie {title: $title})
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      OPTIONAL MATCH (d:Person)-[:DIRECTED]->(m)
      OPTIONAL MATCH (a:Person)-[:ACTED_IN]->(m)
      RETURN m.title AS title, m.year AS year,
             collect(DISTINCT g.name) AS genres,
             collect(DISTINCT d.name) AS directors,
             collect(DISTINCT a.name) AS cast
    `;
    const records = await runQuery(cypher, { title: req.params.title });
    if (!records.length || records[0].get('title') === null) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    const r = records[0];
    res.json({
      title: r.get('title'),
      year: toNum(r.get('year')),
      genres: r.get('genres').filter(Boolean),
      directors: r.get('directors').filter(Boolean),
      cast: r.get('cast').filter(Boolean)
    });
  } catch (err) { next(err); }
});

// GET /api/people?search= - list people with credit counts
router.get('/people', async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const cypher = `
      MATCH (p:Person)
      WHERE $search = '' OR toLower(p.name) CONTAINS toLower($search)
      OPTIONAL MATCH (p)-[:ACTED_IN]->(am:Movie)
      OPTIONAL MATCH (p)-[:DIRECTED]->(dm:Movie)
      WITH p, count(DISTINCT am) AS actingCredits, count(DISTINCT dm) AS directingCredits
      RETURN p.name AS name, actingCredits, directingCredits
      ORDER BY (actingCredits + directingCredits) DESC, p.name ASC
    `;
    const records = await runQuery(cypher, { search });
    res.json(records.map(r => ({
      name: r.get('name'),
      actingCredits: toNum(r.get('actingCredits')),
      directingCredits: toNum(r.get('directingCredits'))
    })));
  } catch (err) { next(err); }
});

// GET /api/people/:name - single person with filmography
router.get('/people/:name', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (p:Person {name: $name})
      OPTIONAL MATCH (p)-[:ACTED_IN]->(am:Movie)
      OPTIONAL MATCH (p)-[:DIRECTED]->(dm:Movie)
      RETURN p.name AS name,
             collect(DISTINCT am.title) AS actedIn,
             collect(DISTINCT dm.title) AS directed
    `;
    const records = await runQuery(cypher, { name: req.params.name });
    if (!records.length || records[0].get('name') === null) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const r = records[0];
    res.json({
      name: r.get('name'),
      actedIn: r.get('actedIn').filter(Boolean),
      directed: r.get('directed').filter(Boolean)
    });
  } catch (err) { next(err); }
});

// GET /api/genres - list genres with movie counts
router.get('/genres', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (g:Genre)
      OPTIONAL MATCH (m:Movie)-[:IN_GENRE]->(g)
      RETURN g.name AS name, count(m) AS movieCount
      ORDER BY movieCount DESC, g.name ASC
    `;
    const records = await runQuery(cypher);
    res.json(records.map(r => ({
      name: r.get('name'),
      movieCount: toNum(r.get('movieCount'))
    })));
  } catch (err) { next(err); }
});

module.exports = router;
