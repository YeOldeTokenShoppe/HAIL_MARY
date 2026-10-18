export const metadata = { title: "La Lotería RL80" };

// The lotería table is a self-contained page built from src/game/loteria (node src/game/loteria/build-table.js),
// copied to public/loteria/table.html. This route frames it.
export default function LoteriaPage() {
  return (
    <main style={{ height: "100vh", margin: 0, background: "#1b1430" }}>
      <iframe
        src="/loteria/table.html"
        title="La Lotería RL80"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
