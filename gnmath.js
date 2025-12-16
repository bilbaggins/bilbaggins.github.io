// ===== CONFIG =====
const GAMES_PATH = "games/";
const COVERS_PATH = "covers/covers-main/";
const MAX_GAMES = 500;

// ===== ELEMENT =====
const container = document.getElementById("games");

if (!container) {
  console.error("Missing #games element in index.html");
}

// ===== LOAD GAMES =====
async function loadGames() {
  container.innerHTML = "";

  for (let i = 0; i < MAX_GAMES; i++) {
    const gameUrl = `${GAMES_PATH}${i}.html`;

    try {
      const res = await fetch(gameUrl, { method: "HEAD" });
      if (!res.ok) break;

      const card = document.createElement("div");
      card.className = "game-card";

      const img = document.createElement("img");
      img.src = `${COVERS_PATH}${i}.png`;
      img.alt = `Game ${i}`;
      img.onerror = () => {
        img.src = `${COVERS_PATH}template.png`;
      };

      const title = document.createElement("div");
      title.className = "game-title";
      title.textContent = "teams";

      card.onclick = () => {
        window.open(gameUrl, "_blank");
      };

      card.appendChild(img);
      card.appendChild(title);
      container.appendChild(card);

    } catch (e) {
      break;
    }
  }
}

// ===== START =====
loadGames();
