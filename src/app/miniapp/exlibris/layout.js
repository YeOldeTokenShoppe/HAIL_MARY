const embedData = {
  version: "1",
  imageUrl: "https://rl80.com/images/screenshot1.png",
  button: {
    title: "Read the Scrolls",
    action: {
      type: "launch_frame",
      name: "RL80",
      url: "https://rl80.com/miniapp/exlibris",
      splashImageUrl: "https://rl80.com/images/saintbot.png",
      splashBackgroundColor: "#0a0a0a"
    }
  }
};

export const metadata = {
  other: {
    'fc:miniapp': JSON.stringify(embedData),
    'base:app_id': '698a7e3fe6f6a95ae49e0002',
  },
};

export default function ExlibrisLayout({ children }) {
  return children;
}
