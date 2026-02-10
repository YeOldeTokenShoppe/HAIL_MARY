export const metadata = {
  title: 'RL80 Gachapon',
  description: 'Claim weekly collectibles from the RL80 Gachapon machine. Hold RL80 tokens to play.',
  openGraph: {
    title: 'RL80 Gachapon',
    description: 'Claim weekly collectibles from the RL80 Gachapon machine',
    images: [
      {
        url: 'https://rl80.com/api/og/prize?name=RL80+Gachapon&edition=100',
        width: 1200,
        height: 800,
        alt: 'RL80 Gachapon',
      },
    ],
  },
};

export default function GachaponLayout({ children }) {
  return children;
}
