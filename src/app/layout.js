import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { MusicProvider } from "@/components/MusicContext";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { WalletAuthProvider } from "@/components/WalletAuthProvider";
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
                colorPrimary: '#ff006e',  // Neon magenta for primary actions
                colorBackground: 'rgba(0, 0, 0, 0.95)',  // Dark background with transparency
                colorInputBackground: 'rgba(26, 26, 46, 0.8)',  // Dark input backgrounds
                colorInputText: '#ffffff',
                colorText: '#ffffff',  // White text for readability
                colorTextOnPrimaryBackground: '#ffffff',  // White text on neon backgrounds
                colorTextSecondary: '#00f5d4',  // Cyan for secondary text
                colorDanger: '#ff006e',
                colorSuccess: '#00ff88',
                colorWarning: '#ffb700',
                colorNeutral: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '0.75rem',
                fontFamily: '"Orbitron", monospace',  // Match NavControls font
                fontFamilyButtons: '"Orbitron", monospace',  // Consistent font
                fontSize: '13px',
                spacingUnit: '12px',
                fontWeight: {
                  normal: 400,
                  medium: 500,
                  semibold: 600,
                  bold: 700
                }
              },
              elements: {
                // Main modal card styling - compact like ThirdwebBuyModal
                card: {
                  backgroundColor: 'rgba(20, 20, 30, 0.98)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 0 40px rgba(138, 43, 226, 0.3)',
                  border: '2px solid rgba(138, 43, 226, 0.4)',
                  borderRadius: '16px',
                  padding: '20px',
                  width: '400px !important',
                  maxWidth: '90vw',
                  maxHeight: '85vh !important',
                  overflow: 'auto !important',
                  position: 'relative'
                },
                rootBox: {
                  width: '100%',
                  maxWidth: '400px !important',
                  margin: '0 auto'
                },
                modalContent: {
                  width: '100%',
                  maxWidth: '400px !important',
                  maxHeight: '85vh !important',
                  overflow: 'auto !important'
                },
                // Modal header styling - more compact
                header: {
                  padding: '0 0 16px 0 !important'
                },
                headerTitle: {
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '18px !important',
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: '8px !important',
                  textAlign: 'left'
                },
                headerSubtitle: {
                  color: 'rgba(0, 245, 212, 0.8)',
                  fontSize: '11px !important',
                  letterSpacing: '0.5px',
                  marginBottom: '12px !important',
                  textAlign: 'left'
                },
                // Close button - compact yellow X
                modalCloseButton: {
                  position: 'absolute !important',
                  top: '12px !important',
                  right: '12px !important',
                  backgroundColor: '#ffee00 !important',
                  color: '#000 !important',
                  width: '28px !important',
                  height: '28px !important',
                  borderRadius: '4px !important',
                  padding: '0 !important',
                  display: 'flex !important',
                  alignItems: 'center !important',
                  justifyContent: 'center !important',
                  fontSize: '18px !important',
                  fontWeight: 'bold !important',
                  border: 'none !important',
                  boxShadow: '0 0 15px rgba(255, 238, 0, 0.5) !important',
                  transform: 'rotate(45deg)',
                  '&:hover': {
                    backgroundColor: '#fff !important',
                    boxShadow: '0 0 20px rgba(255, 238, 0, 0.7) !important',
                    transform: 'rotate(45deg) scale(1.05)'
                  }
                },
                formButtonPrimary: {
                  background: '#ffffff',
                  color: '#000000',
                  fontWeight: '600',
                  fontSize: '14px !important',
                  padding: '12px 24px !important',
                  borderRadius: '40px !important',
                  textTransform: 'none',
                  letterSpacing: '0.5px',
                  border: 'none',
                  boxShadow: '0 2px 15px rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ff006e, #8338ec)',
                    color: '#ffffff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(255, 0, 110, 0.4)'
                  }
                },
                footerActionLink: {
                  color: '#00f5d4',
                  textDecoration: 'none',
                  textShadow: '0 0 5px rgba(0, 245, 212, 0.5)',
                  '&:hover': {
                    color: '#ff006e',
                    textShadow: '0 0 10px rgba(255, 0, 110, 0.8)'
                  }
                },
                socialButtonsBlockButton: {
                  backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
                  border: '2px solid rgba(255, 0, 110, 0.4) !important',
                  color: '#ffffff !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: '0 0 15px rgba(255, 0, 110, 0.3) !important',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 110, 0.2) !important',
                    borderColor: '#ff006e !important',
                    color: '#ff006e !important',
                    transform: 'scale(1.05)',
                    boxShadow: '0 0 25px rgba(255, 0, 110, 0.5) !important'
                  }
                },
                socialButtonsBlockButtonText: {
                  color: 'inherit !important',
                  fontFamily: '"Georgia", "Times New Roman", serif'
                },
                socialButtonsIconButton: {
                  backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
                  border: '2px solid rgba(0, 245, 212, 0.4) !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: '0 0 15px rgba(0, 245, 212, 0.3) !important',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 245, 212, 0.2) !important',
                    borderColor: '#00f5d4 !important',
                    transform: 'scale(1.1)',
                    boxShadow: '0 0 25px rgba(0, 245, 212, 0.5) !important'
                  }
                },
                socialButtonsProviderIcon: {
                  filter: 'brightness(1.2)'
                },
                identityPreviewEditButtonIcon: {
                  color: '#FFD700'
                },
                formFieldInput: {
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: '1px',
                  borderRadius: '8px !important',
                  color: '#ffffff',
                  fontSize: '13px',
                  padding: '10px 12px !important',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    borderColor: '#00f5d4',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    boxShadow: '0 0 0 1px #00f5d4, 0 0 15px rgba(0, 245, 212, 0.2)'
                  },
                  '&:hover': {
                    borderColor: 'rgba(0, 245, 212, 0.2)'
                  }
                },
                formFieldRow: {
                  marginBottom: '12px !important'
                },
                formFieldLabelRow: {
                  marginBottom: '6px !important'
                },
                dividerLine: {
                  background: 'linear-gradient(90deg, transparent, rgba(255, 0, 110, 0.3), transparent)',
                  margin: '16px 0 !important'
                },
                dividerText: {
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontSize: '10px !important'
                },
                dividerRow: {
                  margin: '16px 0 !important'
                },
                formFieldLabel: {
                  color: 'rgba(0, 245, 212, 0.7)',
                  fontWeight: '600',
                  fontSize: '11px !important',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
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
                // User profile modal - matching ThirdwebBuyModal style
                userButtonPopoverCard: {
                  backgroundColor: 'rgba(20, 20, 30, 0.98) !important',
                  backdropFilter: 'blur(20px) !important',
                  border: 'none !important',
                  borderRadius: '20px !important',
                  boxShadow: `
                    0 0 0 1px rgba(255, 238, 0, 0.1),
                    0 0 60px rgba(138, 43, 226, 0.4),
                    0 0 120px rgba(255, 0, 110, 0.3),
                    inset 0 0 60px rgba(138, 43, 226, 0.05)
                  `,
                  padding: '24px !important',
                  width: '360px !important',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-2px',
                    left: '-2px',
                    right: '-2px',
                    bottom: '-2px',
                    background: 'linear-gradient(135deg, #ff006e, #8338ec, #00f5d4, #ffee00)',
                    borderRadius: '22px',
                    zIndex: -1,
                    opacity: 0.8
                  }
                },
                userButtonPopoverActions: {
                  backgroundColor: 'transparent !important',
                  padding: '8px !important',
                  gap: '4px !important'
                },
                userButtonPopoverActionButton: {
                  color: 'rgba(255, 255, 255, 0.8) !important',
                  padding: '8px 12px !important',
                  fontSize: '12px !important',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 110, 0.1) !important',
                    color: '#ff006e !important',
                    textShadow: '0 0 10px rgba(255, 0, 110, 0.8) !important'
                  },
                  // Specifically style the sign out button
                  '&[data-localization-key="userButton.action__signOut"]': {
                    color: '#ff006e !important',
                    borderTop: '1px solid rgba(255, 0, 110, 0.2) !important',
                    marginTop: '8px !important',
                    paddingTop: '12px !important'
                  }
                },
                userButtonPopoverActionButtonText: {
                  color: 'inherit !important'
                },
                userButtonPopoverActionButtonIcon: {
                  color: '#00f5d4 !important'
                },
                userButtonPopoverFooter: {
                  backgroundColor: 'rgba(255, 0, 110, 0.05) !important',
                  borderTop: '1px solid rgba(255, 0, 110, 0.2) !important',
                  padding: '8px 12px !important',
                  marginTop: '8px !important'
                },
                avatarBox: {
                  backgroundColor: 'transparent !important',
                  border: '2px solid #00f5d4 !important',
                  boxShadow: '0 0 20px rgba(0, 245, 212, 0.4) !important'
                },
                userPreviewMainIdentifier: {
                  color: '#ffffff !important',
                  fontWeight: '700 !important',
                  fontSize: '13px !important',
                  textShadow: '0 0 10px rgba(255, 0, 110, 0.5) !important'
                },
                userPreviewSecondaryIdentifier: {
                  color: '#00f5d4 !important',
                  fontSize: '11px !important'
                },
                // Badge styles
                badge: {
                  background: 'linear-gradient(135deg, #ff006e, #8338ec) !important',
                  color: '#ffffff !important',
                  borderRadius: '6px !important',
                  padding: '4px 10px !important',
                  fontSize: '10px !important',
                  fontWeight: '700 !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '1px !important',
                  boxShadow: '0 0 15px rgba(255, 0, 110, 0.5) !important'
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
                  background: 'linear-gradient(135deg, #ff006e, #8338ec) !important',
                  color: '#ffffff !important',
                  border: '2px solid #ff006e !important',
                  fontWeight: '700 !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '1px !important',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #8338ec, #ff006e) !important',
                    boxShadow: '0 0 20px rgba(255, 0, 110, 0.5) !important'
                  }
                },
                // Profile modal specific styles for better visibility
                profileSection: {
                  color: '#00FFFF !important',
                  padding: '8px !important',
                  marginBottom: '4px !important'
                },
                profileSectionTitle: {
                  color: '#ff006e !important',
                  fontWeight: '700 !important',
                  fontSize: '13px !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '0.5px !important',
                  marginBottom: '8px !important'
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
                  color: '#00f5d4 !important'
                },
                accordionTriggerButton: {
                  color: '#ffffff !important',
                  padding: '8px 12px !important',
                  fontSize: '12px !important',
                  borderBottom: '1px solid rgba(255, 0, 110, 0.2) !important',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 110, 0.1) !important',
                    color: '#ff006e !important'
                  }
                },
                accordionContent: {
                  color: '#ffffff !important'
                },
                modalContent: {
                  backgroundColor: 'rgba(0, 0, 0, 0.95) !important',
                  backdropFilter: 'blur(20px) !important'
                },
                modalCloseButton: {
                  color: '#ff006e !important',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 110, 0.1) !important',
                    transform: 'scale(1.1)'
                  }
                },
                navbarButton: {
                  color: 'rgba(255, 255, 255, 0.8) !important',
                  '&:hover': {
                    color: '#ff006e !important'
                  }
                },
                navbarButtonIcon: {
                  color: '#00f5d4 !important'
                },
                // Add custom scrollbar styling for the modal
                scrollbar: {
                  '&::-webkit-scrollbar': {
                    width: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(255, 0, 110, 0.4)',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 0, 110, 0.6)'
                    }
                  }
                },
                // Ensure sign out button is visible
                userButtonPopoverActionButtonIcon__signOut: {
                  color: '#ff006e !important'
                },
                userButtonPopoverActionButtonText__signOut: {
                  color: '#ff006e !important',
                  fontWeight: '600 !important'
                },
                // Compact the user preview section
                userPreview: {
                  padding: '12px !important',
                  gap: '8px !important'
                },
                userButtonPopoverMain: {
                  padding: '0 !important'
                },
                // Fix the profile modal positioning and size
                rootBox: {
                  width: '100% !important',
                  height: '100% !important',
                  display: 'flex !important',
                  alignItems: 'center !important',
                  justifyContent: 'center !important'
                },
                cardBox: {
                  width: '360px !important',
                  maxWidth: '90vw !important',
                  maxHeight: '80vh !important',
                  margin: '0 auto !important',
                  position: 'relative !important',
                  left: 'auto !important',
                  right: 'auto !important',
                  transform: 'none !important',
                  overflow: 'hidden !important'
                },
                // More compact navbar
                navbar: {
                  padding: '8px 12px !important',
                  minHeight: 'auto !important'
                },
                navbarMobileMenuRow: {
                  minHeight: 'auto !important',
                  padding: '4px !important'
                },
                // Compact page sections
                pageScrollBox: {
                  padding: '12px !important',
                  overflowX: 'hidden !important',
                  overflowY: 'auto !important'
                },
                scrollBox: {
                  overflowX: 'hidden !important',
                  padding: '0 !important'
                },
                profilePage: {
                  gap: '12px !important'
                },
                // Smaller form fields
                formFieldRow: {
                  gap: '4px !important',
                  marginBottom: '8px !important'
                },
                formFieldLabelRow: {
                  marginBottom: '2px !important',
                  padding: '0 !important'
                },
                formField: {
                  marginBottom: '8px !important'
                },
                // Compact buttons row
                formButtonReset: {
                  fontSize: '11px !important',
                  padding: '6px 12px !important'
                },
                formResendCodeLink: {
                  fontSize: '11px !important'
                },
                // Prevent horizontal scroll
                main: {
                  overflowX: 'hidden !important',
                  width: '100% !important'
                },
                profileSectionContent: {
                  overflowX: 'hidden !important',
                  wordBreak: 'break-word !important'
                },
                // Reduce avatar size
                avatarImageElementContainer: {
                  width: '60px !important',
                  height: '60px !important'
                },
                avatarBox: {
                  width: '60px !important',
                  height: '60px !important',
                  backgroundColor: 'transparent !important',
                  border: '2px solid #00f5d4 !important',
                  boxShadow: '0 0 20px rgba(0, 245, 212, 0.4) !important'
                },
                // Tighter button spacing
                profileSectionPrimaryButton: {
                  background: 'linear-gradient(135deg, #ff006e, #8338ec) !important',
                  color: '#ffffff !important',
                  border: '2px solid #ff006e !important',
                  fontWeight: '700 !important',
                  fontSize: '10px !important',
                  padding: '6px 12px !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '0.5px !important',
                  marginTop: '8px !important',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #8338ec, #ff006e) !important',
                    boxShadow: '0 0 20px rgba(255, 0, 110, 0.5) !important'
                  }
                },
                // Reduce footer padding
                footer: {
                  padding: '8px !important',
                  marginTop: '8px !important',
                  '& a': {
                    color: '#FFD700',
                    fontSize: '10px !important'
                  }
                }
              }
            }}
          >
            <WalletAuthProvider>
              <LanguageProvider>
                <MusicProvider>
                  {children}
                </MusicProvider>
              </LanguageProvider>
            </WalletAuthProvider>
          </ClerkProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}