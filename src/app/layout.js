import "./globals.css";
import ConditionalClerkProvider from "@/components/ConditionalClerkProvider";
import { MusicProvider } from "@/components/MusicContext";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/components/LanguageProvider";

// import ConditionalIllumin80 from "@/components/ConditionalIllumin80"

export const metadata = {
  title: '𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙',
  icons: {
    icon: '/favicon.svg', // or '/icon.png' if you use PNG
    apple: '/apple-icon.png', // optional: for Apple devices
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
        {/* <link rel="preload" href="/fonts/Orbitron.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /> */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bitcount+Single+Ink&family=Orbitron:wght@400;700;800;900&family=UnifrakturCook&family=UnifrakturMaguntia&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{__html: `
          /* Critical: Hide custom font text until loaded */
          // [style*="UnifrakturCook"],
          // [style*="UnifrakturMaguntia"] {
          //   visibility: hidden !important;
          // }
          .fonts-loaded [style*="UnifrakturCook"],
          .fonts-loaded [style*="UnifrakturMaguntia"] {
            visibility: visible !important;
          }
        `}} />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, backgroundColor: '#000000' }}>
        <ThirdwebProvider>
          <ConditionalClerkProvider>
            <LanguageProvider>
              <MusicProvider>
                {children}
              </MusicProvider>
            </LanguageProvider>
          </ConditionalClerkProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}