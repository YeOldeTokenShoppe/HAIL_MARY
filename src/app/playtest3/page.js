export const metadata = { title: "R-cana Playtest 3" };

// Playtest 3 — One Money: a single currency in $M, cash only, first to $1 billion, two players,
// two-state Credibility, one d8, the earned halo. The cards wear the code-drawn frame.
// Built from src/game/playtest3 (npm run pt3:build → src/game/playtest3/pt3-build.js), copied to public/playtest3/table.html.
export default function Playtest3Page() {
  return (
    <main style={{ height: "100vh", margin: 0, background: "#1b1430" }}>
      <iframe
        src="/playtest3/table.html"
        title="R-cana Playtest 3"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
