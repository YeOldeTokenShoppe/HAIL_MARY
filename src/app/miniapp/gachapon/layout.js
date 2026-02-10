const embedData = {
  version: "1",
  imageUrl: "https://rl80.com/gachaponScreenshot.jpg",
  button: {
    title: "Play Gachapon",
    action: {
      type: "launch_frame",
      name: "RL80 Gachapon",
      url: "https://rl80.com/miniapp/gachapon",
      splashImageUrl: "https://rl80.com/favicon.svg",
      splashBackgroundColor: "#0a0a0a"
    }
  }
};

export const metadata = {
  title: 'RL80 Gachapon',
  description: 'Claim weekly collectibles from the RL80 Gachapon machine. Hold RL80 tokens to play.',
  openGraph: {
    title: 'RL80 Gachapon',
    description: 'Claim weekly collectibles from the RL80 Gachapon machine',
    images: [
      {
        url: 'https://rl80.com/gachaponScreenshot.jpg',
        width: 1200,
        height: 800,
        alt: 'RL80 Gachapon',
      },
    ],
  },
  other: {
    'fc:miniapp': JSON.stringify(embedData),
    'base:app_id': '698a7e3fe6f6a95ae49e0002',
  },
};

export default function GachaponLayout({ children }) {
  return children;
}
