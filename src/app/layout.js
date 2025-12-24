import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { MusicProvider } from "@/components/MusicContext";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { dark } from '@clerk/themes';

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
          <ClerkProvider 
            appearance={{
              baseTheme: dark,
              variables: {
                colorPrimary: '#FFD700',  // Gold color for buttons
                colorBackground: '#1a1a2e',  // Dark navy blue background
                colorInputBackground: '#ffffff',  // Slightly lighter for inputs
                colorInputText: '#000',
                colorText: '#00FFFF',  // Changed from black to cyan for better visibility
                colorTextOnPrimaryBackground: '#000000',  // Black text on gold buttons
                colorTextSecondary: '#FFD700',  // Changed to gold for better contrast
                colorDanger: '#ff6b6b',
                colorSuccess: '#4CAF50',
                colorWarning: '#FFC107',
                colorNeutral: '#8e8e8e',
                borderRadius: '0.5rem',
                fontFamily: '"UnifrakturCook", "UnifrakturMaguntia", serif',  // Change this to your preferred font
                fontFamilyButtons: '"Georgia", "Times New Roman", serif',  // Font for buttons
                fontSize: '16px',
                fontWeight: {
                  normal: 400,
                  medium: 500,
                  semibold: 600,
                  bold: 700
                }
              },
              elements: {
                card: {
                  backgroundColor: '#1a1a2e',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                  border: '2px solid rgba(0, 255, 255, 0.3)'
                },
                headerTitle: {
                  color: '#00FFFF',
                  fontWeight: '700',
                  textShadow: '2px 2px 4px rgba(0, 255, 255, 0.5)'
                },
                headerSubtitle: {
                  color: '#FFD700',
                  fontStyle: 'italic',
                  fontSize: '1.1rem'
                },
                formButtonPrimary: {
                  backgroundColor: '#FFD700',
                  color: '#000000',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                  '&:hover': {
                    backgroundColor: '#FFC700',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 8px rgba(0, 0, 0, 0.4)'
                  }
                },
                footerActionLink: {
                  color: '#FFD700',
                  textDecoration: 'underline',
                  '&:hover': {
                    color: '#ffffff',
                    textDecoration: 'none'
                  }
                },
                socialButtonsBlockButton: {
                  backgroundColor: 'rgba(0, 255, 255, 0.15) !important',  // Translucent cyan
                  border: '2px solid #00FFFF !important',  // Cyan border
                  color: '#00FFFF !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1) !important',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: '#FFD700 !important',  // Gold on hover
                    borderColor: '#FFD700 !important',
                    color: '#000000 !important',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 10px rgba(255, 215, 0, 0.3)'
                  }
                },
                socialButtonsBlockButtonText: {
                  color: 'inherit !important',
                  fontFamily: '"Georgia", "Times New Roman", serif'
                },
                socialButtonsIconButton: {
                  backgroundColor: 'rgba(0, 255, 255, 0.15) !important',  // Translucent cyan
                  border: '2px solid #00FFFF !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1) !important',
                  '&:hover': {
                    backgroundColor: '#FFD700 !important',
                    borderColor: '#FFD700 !important',
                    transform: 'scale(1.1)',
                    boxShadow: '0 6px 10px rgba(255, 215, 0, 0.3)'
                  }
                },
                socialButtonsProviderIcon: {
                  filter: 'brightness(1.2)'
                },
                identityPreviewEditButtonIcon: {
                  color: '#FFD700'
                },
                formFieldInput: {
                  backgroundColor: '#ffffff',
                  borderColor: '#3a3444',
                  '&:focus': {
                    borderColor: '#FFD700',
                    boxShadow: '0 0 0 1px #FFD700'
                  }
                },
                dividerLine: {
                  backgroundColor: 'rgba(255, 215, 0, 0.3)'
                },
                dividerText: {
                  color: '#ffffff',
                  fontWeight: '500',
                  textTransform: 'lowercase',
                  fontStyle: 'italic'
                },
                formFieldLabel: {
                  color: '#00FFFF',  // Changed from black to cyan for visibility
                  fontWeight: '600',
                  fontSize: '1rem'
                },
                footer: {
                  '& a': {
                    color: '#FFD700'
                  }
                },
                // User button and profile modal styles
                userButtonBox: {
                  backgroundColor: 'transparent !important',
                  border: 'none !important',
                  boxShadow: 'none !important'
                },
                userButtonTrigger: {
                  border: 'none !important',
                  boxShadow: 'none !important',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    transition: 'transform 0.2s ease'
                  }
                },
                userButtonPopoverCard: {
                  backgroundColor: '#1a1a2e !important',
                  border: '2px solid #00FFFF !important',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 255, 255, 0.2) !important'
                },
                userButtonPopoverActions: {
                  backgroundColor: '#1a1a2e !important'
                },
                userButtonPopoverActionButton: {
                  color: '#ffffff !important',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1) !important',
                    color: '#00FFFF !important'
                  }
                },
                userButtonPopoverActionButtonText: {
                  color: 'inherit !important'
                },
                userButtonPopoverActionButtonIcon: {
                  color: '#00FFFF !important'
                },
                userButtonPopoverFooter: {
                  backgroundColor: 'rgba(0, 255, 255, 0.05) !important',
                  borderTop: '1px solid rgba(0, 255, 255, 0.2) !important'
                },
                avatarBox: {
                  backgroundColor: '#00FFFF !important',
                  color: '#1a1a2e !important',
                  fontWeight: 'bold !important',
                  border: '2px solid #FFD700 !important',
                  boxShadow: '0 0 10px rgba(255, 215, 0, 0.3) !important'
                },
                userPreviewMainIdentifier: {
                  color: '#00FFFF !important',
                  fontWeight: 'bold !important',
                  textShadow: '0 0 5px rgba(0, 255, 255, 0.5) !important'
                },
                userPreviewSecondaryIdentifier: {
                  color: '#FFD700 !important'
                },
                // Badge styles
                badge: {
                  backgroundColor: '#FFD700 !important',
                  color: '#1a1a2e !important',
                  borderRadius: '4px !important',
                  padding: '2px 8px !important',
                  fontSize: '11px !important',
                  fontWeight: 'bold !important',
                  textTransform: 'uppercase !important',
                  boxShadow: '0 0 10px rgba(255, 215, 0, 0.4) !important'
                },
                // Special Illumin80 member styling
                userButtonAvatarBox: {
                  '&[data-illumin80="true"]': {
                    border: '3px solid #FFD700 !important',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), inset 0 0 10px rgba(255, 215, 0, 0.3) !important',
                    animation: 'illumin80Pulse 3s ease-in-out infinite'
                  }
                },
                profileSectionPrimaryButton: {
                  backgroundColor: '#00FFFF !important',
                  color: '#1a1a2e !important',
                  '&:hover': {
                    backgroundColor: '#FFD700 !important'
                  }
                },
                // Profile modal specific styles for better visibility
                profileSection: {
                  color: '#00FFFF !important'
                },
                profileSectionTitle: {
                  color: '#00FFFF !important',
                  fontWeight: 'bold !important'
                },
                profileSectionContent: {
                  color: '#ffffff !important'
                },
                profileSectionItem: {
                  color: '#ffffff !important'
                },
                profileSectionItemText: {
                  color: '#ffffff !important'
                },
                profileSectionItemSubText: {
                  color: '#FFD700 !important'
                },
                accordionTriggerButton: {
                  color: '#00FFFF !important',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1) !important'
                  }
                },
                accordionContent: {
                  color: '#ffffff !important'
                },
                modalContent: {
                  backgroundColor: '#1a1a2e !important'
                },
                modalCloseButton: {
                  color: '#FFD700 !important',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 215, 0, 0.1) !important'
                  }
                },
                navbarButton: {
                  color: '#00FFFF !important'
                },
                navbarButtonIcon: {
                  color: '#FFD700 !important'
                }
              }
            }}
          >
            <LanguageProvider>
              <MusicProvider>
                {children}
              </MusicProvider>
            </LanguageProvider>
          </ClerkProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}