export const metadata = { title: "R-cana Playtest" };

// The first-playtest table is a self-contained page built from src/game/playtest1 (node src/game/playtest1/pt-build.js),
// copied to public/playtest1/table.html. This route frames it.
export default function PlaytestPage() {
  return (
    <main style={{ height: "100vh", margin: 0, background: "#1b1430" }}>
      <iframe
        src="/playtest1/table.html"
        title="R-cana Playtest"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
