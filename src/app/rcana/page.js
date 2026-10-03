export const metadata = { title: "R-cana" };

// The card table is a self-contained page built from src/game/rcana (node src/game/rcana/build-table.js,
// or `npm run rcana:build`), copied to public/rcana/table.html. This route frames it.
export default function RcanaPage() {
  return (
    <main style={{ height: "100vh", margin: 0, background: "#12221c" }}>
      <iframe
        src="/rcana/table.html"
        title="R-cana table"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
