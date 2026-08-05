require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getDriver, runQuery, closeDriver } = require('../db/neo4j');
const { movies } = require('./data');

async function ensureConstraints() {
  const constraints = [
    'CREATE CONSTRAINT movie_title IF NOT EXISTS FOR (m:Movie) REQUIRE m.title IS UNIQUE',
    'CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE',
    'CREATE CONSTRAINT genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE'
  ];
  for (const statement of constraints) {
    await runQuery(statement);
  }
}

// MERGE everywhere means re-running this script is safe: it will never
// create duplicate nodes or relationships, it just confirms the graph
// already looks right.
async function seedMovie(movie) {
  const cypher = `
    MERGE (m:Movie {title: $title})
    SET m.year = $year

    FOREACH (genreName IN $genres |
      MERGE (g:Genre {name: genreName})
      MERGE (m)-[:IN_GENRE]->(g)
    )

    FOREACH (directorName IN $directors |
      MERGE (d:Person {name: directorName})
      MERGE (d)-[:DIRECTED]->(m)
    )

    FOREACH (actorName IN $cast |
      MERGE (a:Person {name: actorName})
      MERGE (a)-[:ACTED_IN]->(m)
    )
  `;
  await runQuery(cypher, {
    title: movie.title,
    year: movie.year,
    genres: movie.genres,
    directors: movie.directors,
    cast: movie.cast
  });
}

async function seed() {
  const driver = getDriver();
  if (!driver) {
    console.error('No CognoDB connection configured. Copy backend/.env.example to backend/.env and fill it in.');
    process.exit(1);
  }

  console.log('Checking connection to CognoDB...');
  try {
    await driver.verifyConnectivity();
  } catch (err) {
    console.error('Could not connect to CognoDB:', err.message);
    process.exit(1);
  }

  console.log('Ensuring uniqueness constraints...');
  await ensureConstraints();

  console.log(`Seeding ${movies.length} movies...`);
  for (const movie of movies) {
    await seedMovie(movie);
    process.stdout.write('.');
  }
  console.log('\nSeed complete.');

  const [counts] = (await runQuery(`
    MATCH (m:Movie) WITH count(m) AS movieCount
    MATCH (p:Person) WITH movieCount, count(p) AS personCount
    MATCH (g:Genre) WITH movieCount, personCount, count(g) AS genreCount
    RETURN movieCount, personCount, genreCount
  `)).map(r => ({
    movieCount: r.get('movieCount').toNumber(),
    personCount: r.get('personCount').toNumber(),
    genreCount: r.get('genreCount').toNumber()
  }));

  console.log(`Graph now has ${counts.movieCount} movies, ${counts.personCount} people, ${counts.genreCount} genres.`);
  await closeDriver();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err);
  await closeDriver();
  process.exit(1);
});
