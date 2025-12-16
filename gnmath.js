const gamesContainer = document.getElementById("games");

const TOTAL_GAMES = 700; // <-- THIS IS THE IMPORTANT LINE

for (let i = 0; i < TOTAL_GAMES; i++) {
  const gamePath = `games/${i}.html`;
  const coverPath = `covers/covers-main/${i}.png`;

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
}
