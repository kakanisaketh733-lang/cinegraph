// app.js — CineGraph frontend
// Vanilla JS, no build step. Talks to the Express API under /api.

const API = "/api";

// ---------- tiny helpers ----------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function loading(container, message = "Loading…") {
  container.innerHTML = "";
  container.appendChild(el("p", { class: "loading-state", text: message }));
}

function empty(container, message) {
  container.innerHTML = "";
  container.appendChild(el("p", { class: "empty-state", text: message }));
}

async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (res.status === 503) {
    showDbBanner();
    throw new Error("Database unreachable");
  }
  hideDbBanner();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function showError(container, err) {
  container.innerHTML = "";
  container.appendChild(el("p", { class: "error-state", text: err.message || "Something went wrong." }));
}

function showDbBanner() {
  document.getElementById("db-banner").hidden = false;
}
function hideDbBanner() {
  document.getElementById("db-banner").hidden = true;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- tabs ----------

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
  });
});

// ---------- Explore ----------

const movieResults = document.getElementById("movie-results");
const personResults = document.getElementById("person-results");
const movieSearch = document.getElementById("movie-search");
const personSearch = document.getElementById("person-search");
const detailDrawer = document.getElementById("detail-drawer");

async function loadMovies(query = "") {
  loading(movieResults, "Loading movies…");
  try {
    const { movies } = await api(`/movies?search=${encodeURIComponent(query)}`);
    if (movies.length === 0) return empty(movieResults, "No movies match that search.");
    movieResults.innerHTML = "";
    movies.forEach((m) => {
      const card = el("div", { class: "stub-card", tabindex: "0", onclick: () => showMovieDetail(m.title) }, [
        el("div", {}, [
          el("div", { class: "stub-title", text: m.title }),
          el("div", { class: "stub-sub", text: `${m.director || "Unknown director"} · ${m.year}` }),
        ]),
        el("span", { class: "stub-tag", text: (m.genres && m.genres[0]) || "—" }),
      ]);
      movieResults.appendChild(card);
    });
  } catch (err) {
    showError(movieResults, err);
  }
}

async function loadPeople(query = "") {
  loading(personResults, "Loading people…");
  try {
    const { people } = await api(`/people?search=${encodeURIComponent(query)}`);
    if (people.length === 0) return empty(personResults, "No one matches that search.");
    personResults.innerHTML = "";
    people.forEach((p) => {
      const roleBits = [];
      if (p.actingCredits) roleBits.push(`${p.actingCredits} acting credit${p.actingCredits > 1 ? "s" : ""}`);
      if (p.directingCredits) roleBits.push(`${p.directingCredits} directing credit${p.directingCredits > 1 ? "s" : ""}`);
      const card = el("div", { class: "stub-card", tabindex: "0", onclick: () => showPersonDetail(p.name) }, [
        el("div", {}, [
          el("div", { class: "stub-title", text: p.name }),
          el("div", { class: "stub-sub", text: roleBits.join(" · ") }),
        ]),
        el("span", { class: "stub-tag", text: p.directingCredits ? "Director" : "Actor" }),
      ]);
      personResults.appendChild(card);
    });
  } catch (err) {
    showError(personResults, err);
  }
}

async function showMovieDetail(title) {
  detailDrawer.hidden = false;
  loading(detailDrawer, "Loading movie…");
  try {
    const m = await api(`/movies/${encodeURIComponent(title)}`);
    detailDrawer.innerHTML = "";
    detailDrawer.appendChild(el("h3", { text: m.title }));
    detailDrawer.appendChild(el("p", { class: "stub-sub", text: `Directed by ${m.director || "Unknown"} · ${m.year}` }));
    const chips = el("div", { class: "genre-chips" });
    (m.genres || []).forEach((g) => chips.appendChild(el("span", { class: "genre-chip", text: g })));
    detailDrawer.appendChild(chips);
    detailDrawer.appendChild(el("p", { class: "field-label", text: "Cast", style: "margin-top:16px" }));
    const ul = el("ul");
    (m.cast || []).forEach((c) => ul.appendChild(el("li", { text: c })));
    detailDrawer.appendChild(ul);
  } catch (err) {
    showError(detailDrawer, err);
  }
}

async function showPersonDetail(name) {
  detailDrawer.hidden = false;
  loading(detailDrawer, "Loading filmography…");
  try {
    const p = await api(`/people/${encodeURIComponent(name)}`);
    detailDrawer.innerHTML = "";
    detailDrawer.appendChild(el("h3", { text: p.name }));
    if (p.directed && p.directed.length) {
      detailDrawer.appendChild(el("p", { class: "field-label", text: "Directed" }));
      const ul = el("ul");
      p.directed.forEach((m) => ul.appendChild(el("li", { text: `${m.title} (${m.year})` })));
      detailDrawer.appendChild(ul);
    }
    if (p.actedIn && p.actedIn.length) {
      detailDrawer.appendChild(el("p", { class: "field-label", text: "Acted in", style: "margin-top:14px" }));
      const ul = el("ul");
      p.actedIn.forEach((m) => ul.appendChild(el("li", { text: `${m.title} (${m.year})` })));
      detailDrawer.appendChild(ul);
    }
  } catch (err) {
    showError(detailDrawer, err);
  }
}

movieSearch.addEventListener("input", debounce((e) => loadMovies(e.target.value), 250));
personSearch.addEventListener("input", debounce((e) => loadPeople(e.target.value), 250));

// ---------- Shared: populate person dropdowns ----------

let allPeopleCache = null;
async function getAllPeopleNames() {
  if (allPeopleCache) return allPeopleCache;
  const { people } = await api("/people");
  allPeopleCache = people.map((p) => p.name).sort();
  return allPeopleCache;
}

function fillSelect(selectEl, names) {
  selectEl.innerHTML = "";
  names.forEach((name) => selectEl.appendChild(el("option", { value: name, text: name })));
}

async function populateAllSelects() {
  try {
    const names = await getAllPeopleNames();
    fillSelect(document.getElementById("recommend-person"), names);
    fillSelect(document.getElementById("degrees-from"), names);
    fillSelect(document.getElementById("degrees-to"), names);
    fillSelect(document.getElementById("hidden-person"), names);
    if (names.length > 1) document.getElementById("degrees-to").value = names[1];
  } catch (err) {
    // dropdowns just stay empty; panels will show their own error on run
  }
}

// ---------- Recommend ----------

document.getElementById("recommend-run").addEventListener("click", async () => {
  const name = document.getElementById("recommend-person").value;
  const results = document.getElementById("recommend-results");
  if (!name) return;
  loading(results, `Finding movies for ${name}…`);
  try {
    const { recommendations } = await api(`/recommend/${encodeURIComponent(name)}`);
    if (recommendations.length === 0) return empty(results, `No genre-overlap recommendations found for ${name} yet.`);
    results.innerHTML = "";
    recommendations.forEach((r) => {
      const card = el("div", { class: "stub-card static" }, [
        el("div", {}, [
          el("div", { class: "stub-title", text: r.title }),
          el("div", { class: "stub-sub", text: `${r.director || "Unknown director"} · ${r.year} · shares ${r.sharedGenres.join(", ")}` }),
        ]),
        el("span", { class: "stub-tag", text: `score ${r.score}` }),
      ]);
      results.appendChild(card);
    });
  } catch (err) {
    showError(results, err);
  }
});

// ---------- Six Degrees ----------

document.getElementById("degrees-run").addEventListener("click", async () => {
  const from = document.getElementById("degrees-from").value;
  const to = document.getElementById("degrees-to").value;
  const results = document.getElementById("degrees-results");
  if (!from || !to) return;
  if (from === to) return empty(results, "Pick two different people.");
  loading(results, `Tracing a path from ${from} to ${to}…`);
  try {
    const data = await api(`/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    results.innerHTML = "";
    if (!data.connected) {
      empty(results, `No connection found between ${from} and ${to} within 12 hops.`);
      return;
    }
    results.appendChild(el("div", { class: "degrees-badge", text: `${data.degrees} degree${data.degrees === 1 ? "" : "s"} of separation` }));
    const chainEl = el("div", { class: "chain" });
    data.chain.forEach((node, i) => {
      if (i > 0) chainEl.appendChild(el("span", { class: "chain-link", text: "→" }));
      chainEl.appendChild(
        el("span", {
          class: `chain-node ${node.type === "Movie" ? "movie" : "person"}`,
          text: node.name,
        })
      );
    });
    results.appendChild(chainEl);
  } catch (err) {
    showError(results, err);
  }
});

// ---------- Hidden Co-Stars ----------

document.getElementById("hidden-run").addEventListener("click", async () => {
  const name = document.getElementById("hidden-person").value;
  const results = document.getElementById("hidden-results");
  if (!name) return;
  loading(results, `Looking for hidden connections around ${name}…`);
  try {
    const { hiddenCostars } = await api(`/hidden-costars/${encodeURIComponent(name)}`);
    if (hiddenCostars.length === 0) return empty(results, `No hidden co-stars found for ${name} — they've either worked with everyone in their circle, or the graph is too small here.`);
    results.innerHTML = "";
    hiddenCostars.forEach((h) => {
      const card = el("div", { class: "stub-card static" }, [
        el("div", {}, [
          el("div", { class: "stub-title", text: h.name }),
          el("div", { class: "stub-sub", text: `${h.sharedCoStars} mutual co-stars, via ${h.via.slice(0, 3).join(", ")}${h.via.length > 3 ? "…" : ""}` }),
        ]),
        el("span", { class: "stub-tag", text: `${h.sharedCoStars}×` }),
      ]);
      results.appendChild(card);
    });
  } catch (err) {
    showError(results, err);
  }
});

// ---------- Regular Company ----------

async function loadRegulars() {
  const results = document.getElementById("regulars-results");
  loading(results, "Finding frequent collaborators…");
  try {
    const { collaborators } = await api("/collaborators");
    if (collaborators.length === 0) return empty(results, "No repeat director/actor pairs found yet.");
    results.innerHTML = "";
    collaborators.forEach((c) => {
      const card = el("div", { class: "stub-card static" }, [
        el("div", {}, [
          el("div", { class: "stub-title", text: `${c.director} + ${c.actor}` }),
          el("div", { class: "stub-sub", text: c.movies.join(", ") }),
        ]),
        el("span", { class: "stub-tag", text: `${c.collaborations}×` }),
      ]);
      results.appendChild(card);
    });
  } catch (err) {
    showError(results, err);
  }
}

// ---------- init ----------

(async function init() {
  loadMovies();
  loadPeople();
  loadRegulars();
  await populateAllSelects();
})();
