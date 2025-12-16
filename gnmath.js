const gamesContainer = document.getElementById("games");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");

let allGames = [];

// normalize text for search
function norm(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// load zones.json safely
fetch("zones.json")
  .then(res => res.json())
  .then(data => {
    // 🔹 HANDLE DIFFERENT GN-MATH FORMATS
    if (Array.isArray(data)) {
      allGames = data;
    } else if (Array.isArray(data.zones)) {
      allGames = data.zones;
    } else if (typeof data === "object") {
      // object-based format
      allGames = Object.values(data);
    } else {
      throw new Error("Unknown zones.json format");
    }

    renderGames(allGames);
  })
  .catch(err => {
    gamesContainer.innerHTML = "Failed to load games.";
    console.error("zones.json error:", err);
  });

// render games
function renderGames(list) {
  gamesContainer.innerHTML = "";

  list.forEach(game => {
    // 🔹 FLEXIBLE PROPERTY NAMES
    const name = game.name || game.title || game.id || "Game";
    const path = game.path || game.url || game.link;
    const cover = game.cover || game.img || "";

    if (!path) return;

    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <img src="${cover}" onerror="this.src='covers/covers-main/template.png'">
      <div class="game-title">${name}</div>
    `;

    card.onclick = () => {
      const win = window.open(path, "_blank");
      if (win) {
        win.onload = () => win.document.title = "teams";
      }
    };

    gamesContainer.appendChild(card);
  });
}

// search function
function doSearch() {
  const q = norm(searchInput.value);

  if (!q) {
    renderGames(allGames);
    return;
  }

  const filtered = allGames.filter(game =>
    norm(game.name || game.title || "").includes(q) ||
    norm(game.path || game.url || "").includes(q)
  );

  renderGames(filtered);
}

// button + enter
searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch();
});
