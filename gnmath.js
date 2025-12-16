const gamesContainer = document.getElementById("games");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");

let allGames = [];

// normalize text
function norm(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// load games from zones.json
fetch("zones.json")
  .then(res => res.json())
  .then(data => {
    allGames = data;
    renderGames(allGames);
  })
  .catch(() => {
    gamesContainer.innerHTML = "Failed to load games.";
  });

// render function
function renderGames(list) {
  gamesContainer.innerHTML = "";

  list.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <img src="${game.cover}" onerror="this.src='covers/covers-main/template.png'">
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

// search logic
function doSearch() {
  const q = norm(searchInput.value);

  if (!q) {
    renderGames(allGames);
    return;
  }

  const filtered = allGames.filter(game =>
    norm(game.name).includes(q) ||
    norm(game.path).includes(q)
  );

  renderGames(filtered);
}

// button click
searchBtn.addEventListener("click", doSearch);

// enter key
searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch();
});
