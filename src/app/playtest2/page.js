export const metadata = { title: "R-cana Playtest 2" };

// Playtest 2 — The Trading Desk: Traders with CRED/LIQ, a bench, and the scandal economy.
// Built from src/game/playtest2 (npm run pt2:build → src/game/playtest2/pt2-build.mjs), copied to public/playtest2/table.html.
export default function Playtest2Page() {
  return (
    <main style={{ height: "100vh", margin: 0, background: "#1b1430" }}>
      <iframe
        src="/playtest2/table.html"
        title="R-cana Playtest 2"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
