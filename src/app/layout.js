import "./globals.css";
import Providers from "@/components/Providers";

const siteDescription =
  'Mater ex mahina".';

export const metadata = {
  // Resolves relative image/URL paths below into absolute URLs for crawlers.
  metadataBase: new URL('https://rl80.com'),
  title: '𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙',
  description: siteDescription,
  openGraph: {
    title: '𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙',
    description: siteDescription,
    url: 'https://rl80.com',
    siteName: 'Our Lady of Perpetual Profit',
    type: 'website',
    images: [
      {
        url: 'https://rl80.com/carousel_images/img7.webp',
        width: 960,
        height: 540,
        alt: 'Our Lady of Perpetual Profit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙',
    description: siteDescription,
    images: ['https://rl80.com/carousel_images/img7.webp'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-icon.svg',
  },
  // PWA manifest — required for iOS Add-to-Home-Screen install, which is what
  // unlocks web push on iPhone (Safari only delivers push to installed apps).
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'HMPC',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'base:app_id': '698a7e3fe6f6a95ae49e0002',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bitcount+Single+Ink&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Grenze+Gotisch:wght@400;500;600;700;900&family=Orbitron:wght@400;700;800;900&family=UnifrakturCook&family=UnifrakturMaguntia&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{__html: `
          .fonts-loaded [style*="UnifrakturCook"],
          .fonts-loaded [style*="UnifrakturMaguntia"] {
            visibility: visible !important;
          }
        `}} />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, backgroundColor: '#000000' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
