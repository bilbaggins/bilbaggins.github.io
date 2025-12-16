const gamesContainer = document.getElementById("games");

// CHANGE THIS NUMBER if you add more games
const TOTAL_GAMES = 200;

for (let i = 0; i < TOTAL_GAMES; i++) {
  const imgPath = `covers/covers-main/${i}.png`;
  const gamePath = `games/${i}.html`;

  const card = document.createElement("div");
  card.className = "game-card";

  card.innerHTML = `
    <img src="${imgPath}" onerror="this.src='covers/covers-main/template.png'">
    <div class="game-title">Game ${i}</div>
  `;

  card.onclick = () => {
    const win = window.open(gamePath, "_blank");
    if (win) {
      win.document.title = "teams";
    }
  };

  gamesContainer.appendChild(card);
}
