// Per-route metadata for /oil. Server component (page.js is "use client" and
// can't export metadata). Overrides the site-wide favicon with the Hail Mary
// Prospecting Co. mark just for this route; passes children through unchanged.
export const metadata = {
  icons: {
    icon: [{ url: "/hail-mary-icon.svg", type: "image/svg+xml" }],
  },
};

export default function OilLayout({ children }) {
  return children;
}
