// seed.js
// Loads the curated movie dataset into CognoDB.
// Safe to run more than once: every write uses MERGE, so re-running
// just confirms the same graph exists instead of duplicating it.
//
// Run with:  npm run seed   (from backend/)

require('dotenv').config();
const { getDriver, verifyConnection, closeDriver } = require('../db');
const { movies } = require('./data');

// One constraint per node label keeps MERGE fast and prevents
// accidental duplicate Person/Movie/Genre nodes as the dataset grows.
const CONSTRAINTS = [
  'CREATE CONSTRAINT movie_title IF NOT EXISTS FOR (m:Movie) REQUIRE m.title IS UNIQUE',
  'CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE',
  'CREATE CONSTRAINT genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE',
];

const UPSERT_MOVIE = `
MERGE (m:Movie {title: $title})
SET m.year = $year
WITH m
MERGE (d:Person {name: $director})
MERGE (d)-[:DIRECTED]->(m)
WITH m
UNWIND $genres AS genreName
  MERGE (g:Genre {name: genreName})
  MERGE (m)-[:IN_GENRE]->(g)
WITH m
UNWIND $cast AS actorName
  MERGE (a:Person {name: actorName})
  MERGE (a)-[:ACTED_IN]->(m)
`;

async function seed() {
  console.log('Connecting to CognoDB...');
  const status = await verifyConnection();
  if (!status.ok) {
    console.error('Could not connect to CognoDB:', status.error);
    console.error('Check backend/.env - see backend/.env.example for the expected format.');
    process.exit(1);
  }
  console.log('Connected. Seeding graph...');

  const driver = getDriver();
  const session = driver.session();

  try {
    for (const stmt of CONSTRAINTS) {
      await session.run(stmt);
    }

    let count = 0;
    for (const movie of movies) {
      await session.run(UPSERT_MOVIE, {
        title: movie.title,
        year: movie.year,
        director: movie.director,
        genres: movie.genres,
        cast: movie.cast,
      });
      count += 1;
      process.stdout.write(`\rLoaded ${count}/${movies.length} movies`);
    }
    console.log('\nDone.');

    const summary = await session.run(`
      MATCH (m:Movie) WITH count(m) AS movies
      MATCH (p:Person) WITH movies, count(p) AS people
      MATCH (g:Genre) RETURN movies, people, count(g) AS genres
    `);
    const rec = summary.records[0];
    console.log(
      `Graph now has ${rec.get('movies')} movies, ${rec.get('people')} people, ${rec.get('genres')} genres.`
    );
  } finally {
    await session.close();
    await closeDriver();
  }
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
