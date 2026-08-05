# CineGraph

A movie-credits explorer backed by **CognoDB**, a managed graph database. CineGraph lets you browse films and people, get movie recommendations based on genre overlap, trace the "six degrees" path between two actors, surface pairs of actors who share co-stars but have never worked together directly, and see which directors have a "regular company" of actors they keep casting.

Live demo: `<add your hosted URL here>`
Screen recording: `<add your recording link here>`

---

## 1. Why a graph database?

A film's cast, crew, and genre tags are all about **relationships**, and the interesting questions here are multi-hop ones: *who is two people away from each other through shared films? Which actors run in the same circles but have never actually been cast together?*

In a relational schema you'd model this as `movies`, `people`, `credits` (a join table), and `genres` — and every one of the questions above becomes a **self-join of unknown depth**. "Six degrees between two actors" needs a recursive CTE that re-joins `credits` to itself at every hop, has no natural way to guarantee it finds the *shortest* path, and gets slower and harder to read the deeper it goes. "Hidden co-stars" needs a three-way self-join with a `NOT EXISTS` subquery to exclude direct co-stars — workable, but it stops being obvious what the query is even asking for.

In a graph, those same questions are direct pattern matches:

```cypher
// Six degrees, in one line, and it finds the *shortest* path:
MATCH path = shortestPath((a:Person {name:$from})-[:ACTED_IN*..12]-(b:Person {name:$to}))
RETURN path
```

The relationships (`ACTED_IN`, `DIRECTED`, `IN_GENRE`) are stored as first-class edges instead of being reconstructed via joins at query time, so traversing them — 1 hop or 6 hops — costs roughly the same per step. That's the whole pitch: the schema doesn't change shape as the questions get more relational, because the questions *are* the schema.

---

## 2. Data model

```
        DIRECTED                    ACTED_IN
(:Person) -------> (:Movie) <------------------- (:Person)
                       |
                    IN_GENRE
                       |
                       v
                    (:Genre)
```

- **`(:Person {name})`** — an actor and/or director. Same node either way; a person can have both `DIRECTED` and `ACTED_IN` edges.
- **`(:Movie {title, year})`** — one node per film.
- **`(:Genre {name})`** — one node per genre, shared across movies.
- **`[:DIRECTED]`** — Person → Movie
- **`[:ACTED_IN]`** — Person → Movie
- **`[:IN_GENRE]`** — Movie → Genre

`title`, `name`, and `genre name` are all under uniqueness constraints (see `backend/seed/seed.js`), so re-running the seed script never creates duplicates — it just confirms the graph already looks right.

Seed data: 40 well-known films across ~10 directors and ~60 actors, hand-picked so the graph is genuinely connected (e.g. several Christopher Nolan/Michael Caine films, the Scorsese/DiCaprio run, the Cameron filmography) — enough overlap to make recommendations, paths, and hidden-co-star queries actually turn up interesting results instead of empty ones.

---

## 3. The four graph queries, explained

All queries live in `backend/routes/`, are parameterized (no string-concatenated Cypher), and run through the official Neo4j driver.

### Recommend movies (`routes/recommend.js`) — 2-hop traversal
```cypher
MATCH (p:Person {name:$name})-[:ACTED_IN]->(seen:Movie)-[:IN_GENRE]->(g:Genre)
MATCH (g)<-[:IN_GENRE]-(rec:Movie)
WHERE NOT (p)-[:ACTED_IN]->(rec)
RETURN rec, count(g) AS score ORDER BY score DESC
```
Walks from a person to the movies they've been in, out to those movies' genres, and back in to *other* movies sharing those genres — excluding anything the person's already done. Movies sharing more genres score higher.

### Six degrees (`routes/path.js`) — variable-length shortest path
```cypher
MATCH path = shortestPath((a:Person {name:$from})-[:ACTED_IN*..12]-(b:Person {name:$to}))
```
The query the intro above already covers — this is the one a relational database is genuinely awkward at.

### Hidden co-stars (`routes/collaborators.js`) — 3-hop pattern with an exclusion
```cypher
MATCH (a:Person {name:$name})-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(mutual:Person)
      -[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b:Person)
WHERE a <> b AND NOT (a)-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(b)
RETURN b, count(DISTINCT mutual) AS sharedCoStars
```
Finds people two hops away through a mutual co-star, then filters out anyone actually one hop away (a direct co-star).

### Regular company — aggregation over a 2-hop pattern
```cypher
MATCH (d:Person)-[:DIRECTED]->(m:Movie)<-[:ACTED_IN]-(a:Person)
RETURN d, a, count(m) AS collaborations
```
Counts, for every director/actor pair, how many films they've made together.

---

## 4. Setting up CognoDB — explained simply

Think of CognoDB as a notebook in the cloud that's really good at drawing **circles and arrows** — one circle per thing (a person, a movie), one arrow per relationship (*acted in*, *directed*). Instead of you drawing it by hand, you send it simple sentences like "Tom Hanks *acted in* Forrest Gump," and it remembers the circles and arrows for you, forever, and lets you ask questions like "who is connected to who, and how far apart are they?"

Here's how to get your own notebook running:

1. **Sign up.** Go to `console.cognodb.com/signup` and make an account. It's free, and it doesn't ask for a credit card.
2. **Create an instance.** Click "create instance," pick the free `c0` size and a region close to you. Wait under a minute — it's making your notebook right now.
3. **Copy your password — right away.** The console will show you a connection address (looks like `bolt+s://something.databases.cognodb.cloud`) and a password. **The password is shown exactly once.** Copy both immediately.
4. **Give them to CineGraph, never to GitHub.** In `backend/`, copy `.env.example` to a new file named `.env`, and paste your address and password in:
   ```
   COGNODB_URI=bolt+s://your-instance-id.databases.cognodb.cloud
   COGNODB_USER=cognodb
   COGNODB_PASSWORD=your-generated-password
   ```
   `.env` is already in `.gitignore` — it will never be committed, so your password stays private.
5. **Fill the notebook.** Run the seed script (next section) — it writes all 40 movies, their people, and genres into your instance as circles and arrows.
6. **Ask it questions.** Start the server, open the app, and every button you click sends one of the Cypher queries above to CognoDB and draws the answer on screen.

That's the whole trick: CognoDB speaks the same language ("Bolt" + Cypher) as Neo4j, so this app just uses the standard, official Neo4j driver pointed at CognoDB's address — no special SDK required.

---

## 5. Running it locally

**Requirements:** Node.js 18+, and a CognoDB instance (see above).

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure your connection
cp .env.example .env
# then edit .env with your CognoDB URI + password

# 3. Load the seed data (movies, people, genres)
npm run seed

# 4. Start the server (serves the API + the frontend together)
npm start
```

Then open **http://localhost:4000**.

If the database is unreachable — wrong password, instance paused, no network — the server still starts, but the UI shows a clear "can't reach the database" banner instead of hanging or crashing, and `GET /api/health` reports the connection status directly.

---

## 6. Project structure

```
cinegraph/
├── backend/
│   ├── server.js            # Express app: API routes + serves the frontend
│   ├── db.js                 # Neo4j driver setup, query runner, error handling
│   ├── routes/
│   │   ├── explore.js        # search/detail for movies, people, genres
│   │   ├── recommend.js      # 2-hop genre-overlap recommendations
│   │   ├── path.js           # shortest-path "six degrees"
│   │   └── collaborators.js  # hidden co-stars + frequent director/actor pairs
│   ├── seed/
│   │   ├── data.js           # the 40-movie dataset
│   │   └── seed.js           # idempotent MERGE-based loader
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css              # film-archive visual theme
    └── app.js                 # vanilla JS — fetches the API, renders the UI
```

---

## 7. Deploying

Because the Express server serves both the API and the static frontend from one process, it deploys as a single web service on any free Node host (Render, Railway, Fly.io, etc.):

1. Push this repo to GitHub.
2. Create a new web service pointed at it, with build command `npm install --prefix backend` and start command `npm start --prefix backend`.
3. Set the three `COGNODB_*` environment variables in the host's dashboard (never in the repo).
4. Keep your CognoDB instance running so the live demo keeps working.

---

## 8. Screenshots

`<add 2-3 screenshots of the running app here: Explore, Recommend, Six Degrees>`
