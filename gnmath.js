const gamesContainer = document.getElementById("games");

const MAX_SCAN = 1000; // scans up to this number safely
let found = 0;

async function loadGames() {
  for (let i = 0; i < MAX_SCAN; i++) {
    const gamePath = `games/${i}.html`;
    const coverPath = `covers/covers-main/${i}.png`;

    try {
      const res = await fetch(gamePath, { method: "HEAD" });
      if (!res.ok) continue; // skip missing numbers

      found++;

      const card = document.createElement("div");
      card.className = "game-card";

      card.innerHTML = `
        <img src="${coverPath}" onerror="this.src='covers/covers-main/template.png'">
        <div class="game-title">Game ${i}</div>
      `;

      card.onclick = () => {
        const win = window.open(gamePath, "_blank");
        if (win) {
          win.onload = () => {
            win.document.title = "teams";
          };
        }
      };

      gamesContainer.appendChild(card);
    } catch (e) {
      continue;
    }
  }

  if (found === 0) {
    gamesContainer.innerHTML = "No games found.";
  }
}

loadGames();
