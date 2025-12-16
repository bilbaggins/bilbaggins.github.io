const gamesContainer = document.getElementById("games");
const searchInput = document.getElementById("search");

let allGames = [];

// normalize text for searching
function norm(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// load zones.json (this is your source of truth)
fetch("zones.json")
  .then(res => res.json())
  .then(data => {
    allGames = data;
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

// search logic (uses ORIGINAL names from zones.json)
searchInput.addEventListener("input", () => {
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
});
