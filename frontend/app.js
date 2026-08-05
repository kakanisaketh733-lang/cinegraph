// ============================================================
// CineGraph frontend — plain JS, no build step. Talks to the
// Express API mounted at /api on the same origin.
// ============================================================

const API = '/api';

// ---------- tiny helpers ----------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  let body = null;
  try { body = await res.json(); } catch (_) { /* ignore */ }
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

function showLoading(container, label = 'Loading…') {
  container.innerHTML = '';
  container.appendChild(el('p', { class: 'loading-state' }, label));
}

function showError(container, message) {
  container.innerHTML = '';
  container.appendChild(el('p', { class: 'error-state' }, `Couldn't load that — ${message}`));
}

function showEmpty(container, message) {
  container.innerHTML = '';
  container.appendChild(el('p', { class: 'empty-state' }, message));
}

// ============================================================
// Health banner
// ============================================================
async function checkHealth() {
  const banner = document.getElementById('db-banner');
  try {
    const status = await apiGet('/health');
    if (!status.database) {
      banner.textContent = `Can't reach CognoDB right now (${status.error || 'unknown error'}). Results below will fail until the connection is fixed.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (err) {
    banner.textContent = "Can't reach the CineGraph server.";
    banner.classList.remove('hidden');
  }
}

// ============================================================
// Tabs
// ============================================================
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ============================================================
// Explore panel
// ============================================================
let exploreMode = 'movies';
let exploreDebounce = null;

function initExplore() {
  const searchInput = document.getElementById('explore-search');
  const genreSelect = document.getElementById('explore-genre');
  const modeButtons = document.querySelectorAll('#explore-mode .seg-btn');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      exploreMode = btn.dataset.mode;
      genreSelect.style.display = exploreMode === 'movies' ? '' : 'none';
      runExplore();
    });
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(exploreDebounce);
    exploreDebounce = setTimeout(runExplore, 250);
  });
  genreSelect.addEventListener('change', runExplore);

  loadGenreOptions();
  runExplore();
}

async function loadGenreOptions() {
  try {
    const genres = await apiGet('/genres');
    const select = document.getElementById('explore-genre');
    genres.forEach(g => {
      select.appendChild(el('option', { value: g.name }, `${g.name} (${g.movieCount})`));
    });
  } catch (_) {
    // Genre dropdown is a nicety — swallow errors, search still works without it.
  }
}

async function runExplore() {
  const container = document.getElementById('explore-results');
  const search = document.getElementById('explore-search').value.trim();
  const genre = document.getElementById('explore-genre').value;

  showLoading(container, exploreMode === 'movies' ? 'Pulling films…' : 'Pulling people…');

  try {
    if (exploreMode === 'movies') {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (genre) params.set('genre', genre);
      const movies = await apiGet(`/movies?${params.toString()}`);
      renderMovieCards(container, movies);
    } else {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const people = await apiGet(`/people?${params.toString()}`);
      renderPeopleCards(container, people);
    }
  } catch (err) {
    showError(container, err.message);
  }
}

function renderMovieCards(container, movies) {
  if (!movies.length) return showEmpty(container, 'No films match that search.');
  container.innerHTML = '';
  movies.forEach(m => {
    const chips = el('div', { class: 'chip-row' }, m.genres.map(g => el('span', { class: 'chip' }, g)));
    container.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, m.title),
      el('p', { class: 'meta' }, `${m.year} · dir. ${m.directors.join(', ') || 'unknown'}`),
      chips
    ]));
  });
}

function renderPeopleCards(container, people) {
  if (!people.length) return showEmpty(container, 'No one matches that search.');
  container.innerHTML = '';
  people.forEach(p => {
    const roles = [];
    if (p.directingCredits) roles.push(el('span', { class: 'chip gold' }, `${p.directingCredits} directed`));
    if (p.actingCredits) roles.push(el('span', { class: 'chip' }, `${p.actingCredits} acted`));
    container.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, p.name),
      el('div', { class: 'chip-row' }, roles.length ? roles : [el('span', { class: 'chip' }, 'no credits yet')])
    ]));
  });
}

// ============================================================
// Recommend panel
// ============================================================
function initRecommend() {
  document.getElementById('recommend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('recommend-name').value.trim();
    const container = document.getElementById('recommend-results');
    if (!name) return;
    showLoading(container, 'Walking the genre graph…');
    try {
      const recs = await apiGet(`/recommend/${encodeURIComponent(name)}`);
      renderRecommendations(container, recs);
    } catch (err) {
      showError(container, err.message);
    }
  });
}

function renderRecommendations(container, recs) {
  if (!recs.length) return showEmpty(container, 'No recommendations — try a name with acting credits in the graph.');
  const maxScore = Math.max(...recs.map(r => r.score));
  container.innerHTML = '';
  const list = el('div', { class: 'rec-list' });
  recs.forEach(r => {
    const pct = Math.round((r.score / maxScore) * 100);
    list.appendChild(el('div', { class: 'rec-row' }, [
      el('span', { class: 'rec-title' }, r.title),
      el('span', { class: 'rec-year' }, String(r.year)),
      el('div', { class: 'score-bar-track' }, el('div', { class: 'score-bar-fill', style: `width:${pct}%` })),
    ]));
  });
  container.appendChild(list);
}

// ============================================================
// Six degrees panel
// ============================================================
function initPath() {
  document.getElementById('path-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const from = document.getElementById('path-from').value.trim();
    const to = document.getElementById('path-to').value.trim();
    const container = document.getElementById('path-results');
    if (!from || !to) return;
    showLoading(container, 'Searching for the shortest path…');
    try {
      const result = await apiGet(`/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      renderPath(container, result);
    } catch (err) {
      showError(container, err.message);
    }
  });
}

function renderPath(container, result) {
  container.innerHTML = '';
  if (!result.found) {
    return showEmpty(container, "No path found — these two aren't connected within 12 hops.");
  }
  container.appendChild(el('span', { class: 'degrees-badge' },
    `${result.degrees} degree${result.degrees === 1 ? '' : 's'} of separation`));

  const chain = el('div', { class: 'chain' });
  result.chain.forEach((node, i) => {
    const isPerson = node.type === 'Person';
    chain.appendChild(el('div', { class: `chain-node ${isPerson ? 'person' : 'movie'}` }, [
      el('div', { class: 'chain-bulb' }, isPerson ? '★' : '▭'),
      el('div', { class: 'chain-label' }, node.name)
    ]));
    if (i < result.chain.length - 1) {
      chain.appendChild(el('div', { class: 'chain-connector' }));
    }
  });
  container.appendChild(el('div', { class: 'chain-wrap' }, chain));
}

// ============================================================
// Hidden co-stars panel
// ============================================================
function initHidden() {
  document.getElementById('hidden-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('hidden-name').value.trim();
    const container = document.getElementById('hidden-results');
    if (!name) return;
    showLoading(container, 'Cross-referencing co-stars…');
    try {
      const results = await apiGet(`/collaborators/${encodeURIComponent(name)}`);
      renderHidden(container, results);
    } catch (err) {
      showError(container, err.message);
    }
  });
}

function renderHidden(container, results) {
  if (!results.length) return showEmpty(container, 'No hidden co-stars found for that name.');
  container.innerHTML = '';
  const table = el('table', { class: 'hidden-table' });
  table.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, 'Person'),
    el('th', {}, 'Shared co-stars'),
    el('th', {}, 'Connected via')
  ])));
  const tbody = el('tbody');
  results.forEach(r => {
    tbody.appendChild(el('tr', {}, [
      el('td', {}, r.name),
      el('td', {}, String(r.sharedCoStars)),
      el('td', {}, r.via.join(', '))
    ]));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// ============================================================
// Regular company panel
// ============================================================
function initCompany() {
  document.getElementById('company-run').addEventListener('click', runCompany);
  loadDirectors();
  runCompany();
}

async function loadDirectors() {
  try {
    const rows = await apiGet('/company?minCollaborations=1');
    const select = document.getElementById('company-director');
    const directors = [...new Set(rows.map(r => r.director))].sort();
    directors.forEach(d => select.appendChild(el('option', { value: d }, d)));
  } catch (_) {
    // Filter dropdown is a nicety — the "Run" button still works without it.
  }
}

async function runCompany() {
  const container = document.getElementById('company-results');
  const director = document.getElementById('company-director').value;
  const min = document.getElementById('company-min').value || 2;
  showLoading(container, 'Counting collaborations…');
  try {
    const params = new URLSearchParams({ minCollaborations: min });
    if (director) params.set('director', director);
    const rows = await apiGet(`/company?${params.toString()}`);
    renderCompany(container, rows);
  } catch (err) {
    showError(container, err.message);
  }
}

function renderCompany(container, rows) {
  if (!rows.length) return showEmpty(container, 'No director/actor pairs meet that threshold — try lowering "min. films together".');
  container.innerHTML = '';
  const groups = new Map();
  rows.forEach(r => {
    if (!groups.has(r.director)) groups.set(r.director, []);
    groups.get(r.director).push(r);
  });
  groups.forEach((actors, director) => {
    const group = el('div', { class: 'company-group' }, el('h3', {}, director));
    actors.forEach(a => {
      group.appendChild(el('div', { class: 'company-actor-row' }, [
        el('span', { class: 'actor-name' }, a.actor),
        el('span', { class: 'collab-count' }, `${a.collaborations}× — ${a.movies.join(', ')}`)
      ]));
    });
    container.appendChild(group);
  });
}

// ============================================================
// Boot
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initExplore();
  initRecommend();
  initPath();
  initHidden();
  initCompany();
  checkHealth();
  setInterval(checkHealth, 30000);
});
