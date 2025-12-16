const gamesContainer = document.getElementById("games");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");

// 🔹 AUTO-DETECT BASE PATH (THIS IS THE FIX)
const BASE = location.pathname.replace(/\/[^/]*$/, "");

// real paths
const COVER_URL = `${BASE}/covers/covers-main`;
const HTML_URL = `${BASE}/games`;

let allGames = [];

// normalize text
function norm(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// load zones.json RELATIVELY
fetch(`${BASE}/zones.json`)
  .then(res => {
    if (!res.ok) throw new Error("zones.json not found");
    return res.json();
  })
  .then(data => {
  const games = Array.isArray(data) ? data : data.zones;

  allGames = games.map(game => ({

      id: game.id,
      name: game.name,
      cover: game.cover.replace("{COVER_URL}", COVER_URL),
      path: game.url.replace("{HTML_URL}", HTML_URL)
    }));

    renderGames(allGames);
  })
  .catch(err => {
    gamesContainer.innerHTML = "Failed to load games.";
    console.error(err);
  });

// render games
function renderGames(list) {
  gamesContainer.innerHTML = "";

  list.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <img src="${game.cover}" onerror="this.src='${COVER_URL}/template.png'">
      <div class="game-title">${game.name}</div>
    `;

    card.onclick = () => {
      const win = window.open(game.path, "_blank");
      if (win) {
        win.onload = () => win.document.title = "teams";
      }
    };

    gamesContainer.appendChild(card);
  });
}

// search
function doSearch() {
  const q = norm(searchInput.value);

  if (!q) {
    renderGames(allGames);
    return;
  }

  const filtered = allGames.filter(game =>
    norm(game.name).includes(q) ||
    String(game.id).includes(q)
  );

  renderGames(filtered);
}

searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch();
});
