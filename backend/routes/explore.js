// routes/explore.js
// Basic browsing: search movies/people, and pull the full detail view
// for one movie or one person (their direct graph neighborhood).

const express = require('express');
const { runQuery, toNative } = require('../db');

const router = express.Router();

// GET /api/movies?search=nolan
router.get('/movies', async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const cypher = `
      MATCH (m:Movie)
      WHERE $search = '' OR toLower(m.title) CONTAINS toLower($search)
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      OPTIONAL MATCH (d:Person)-[:DIRECTED]->(m)
      RETURN m.title AS title, m.year AS year, d.name AS director,
             collect(DISTINCT g.name) AS genres
      ORDER BY m.year DESC
      LIMIT 100
    `;
    const records = await runQuery(cypher, { search });
    const movies = records.map((r) => ({
      title: r.get('title'),
      year: toNative(r.get('year')),
      director: r.get('director'),
      genres: r.get('genres'),
    }));
    res.json({ movies });
  } catch (err) {
    next(err);
  }
});

// GET /api/movies/:title
router.get('/movies/:title', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (m:Movie {title: $title})
      OPTIONAL MATCH (d:Person)-[:DIRECTED]->(m)
      OPTIONAL MATCH (a:Person)-[:ACTED_IN]->(m)
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      RETURN m.title AS title, m.year AS year, d.name AS director,
             collect(DISTINCT a.name) AS cast, collect(DISTINCT g.name) AS genres
    `;
    const records = await runQuery(cypher, { title: req.params.title });
    if (records.length === 0) return res.status(404).json({ error: 'Movie not found' });
    const r = records[0];
    res.json({
      title: r.get('title'),
      year: toNative(r.get('year')),
      director: r.get('director'),
      cast: r.get('cast'),
      genres: r.get('genres'),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/people?search=hanks
router.get('/people', async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const cypher = `
      MATCH (p:Person)
      WHERE $search = '' OR toLower(p.name) CONTAINS toLower($search)
      OPTIONAL MATCH (p)-[:ACTED_IN]->(actedIn:Movie)
      OPTIONAL MATCH (p)-[:DIRECTED]->(directed:Movie)
      WITH p, count(DISTINCT actedIn) AS actingCredits, count(DISTINCT directed) AS directingCredits
      WHERE actingCredits > 0 OR directingCredits > 0
      RETURN p.name AS name, actingCredits, directingCredits
      ORDER BY (actingCredits + directingCredits) DESC
      LIMIT 100
    `;
    const records = await runQuery(cypher, { search });
    const people = records.map((r) => ({
      name: r.get('name'),
      actingCredits: toNative(r.get('actingCredits')),
      directingCredits: toNative(r.get('directingCredits')),
    }));
    res.json({ people });
  } catch (err) {
    next(err);
  }
});

// GET /api/people/:name
router.get('/people/:name', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (p:Person {name: $name})
      OPTIONAL MATCH (p)-[:ACTED_IN]->(actedIn:Movie)
      OPTIONAL MATCH (p)-[:DIRECTED]->(directed:Movie)
      RETURN p.name AS name,
             [x IN collect(DISTINCT actedIn) WHERE x IS NOT NULL | {title: x.title, year: x.year}] AS actedIn,
             [x IN collect(DISTINCT directed) WHERE x IS NOT NULL | {title: x.title, year: x.year}] AS directed
    `;
    const records = await runQuery(cypher, { name: req.params.name });
    if (records.length === 0) return res.status(404).json({ error: 'Person not found' });
    const r = records[0];
    res.json({
      name: r.get('name'),
      actedIn: toNative(r.get('actedIn')),
      directed: toNative(r.get('directed')),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/genres
router.get('/genres', async (req, res, next) => {
  try {
    const cypher = `
      MATCH (g:Genre)<-[:IN_GENRE]-(m:Movie)
      RETURN g.name AS name, count(m) AS movieCount
      ORDER BY movieCount DESC
    `;
    const records = await runQuery(cypher);
    res.json({ genres: records.map((r) => ({ name: r.get('name'), movieCount: toNative(r.get('movieCount')) })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
