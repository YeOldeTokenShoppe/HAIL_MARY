import FeedClient from "./FeedClient";

// Public Field Dispatch gallery — the landing destination for shared strikes,
// polaroids, and haul cards. Server component wrapper so the route carries
// proper OG metadata when the feed URL itself is shared.
export const metadata = {
  title: "Field Dispatches — Hail Mary Prospecting Co.",
  description:
    "Live polaroids from the Lyquid80 fields: gushers, hell pockets, and the prospectors who hit them. Real USDC, provably-fair map, rigs that drill 24/7.",
  openGraph: {
    title: "Field Dispatches — Hail Mary Prospecting Co.",
    description: "Live polaroids from the Lyquid80 fields. Real USDC, provably-fair map, rigs that drill 24/7.",
    images: ["/icon-512.png"],
  },
  twitter: {
    card: "summary",
    title: "Field Dispatches — Hail Mary Prospecting Co.",
    description: "Live polaroids from the Lyquid80 fields. Real USDC, provably-fair map, rigs that drill 24/7.",
  },
};

export default function FeedPage() {
  return <FeedClient />;
}
