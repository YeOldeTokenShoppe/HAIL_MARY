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
                colorPrimary: '#00f5d4',  // Cyan for primary actions
                colorBackground: 'rgba(0, 0, 0, 0.95)',  // Dark background with transparency
                colorInputBackground: 'rgba(26, 26, 46, 0.8)',  // Dark input backgrounds
                colorInputText: '#ffffff',
                colorText: '#ffffff',  // White text for readability
                colorTextOnPrimaryBackground: '#000000',  // Black text on cyan backgrounds
                colorTextSecondary: '#00f5d4',  // Cyan for secondary text
                colorDanger: '#ff6b6b',
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
                  boxShadow: '0 20px 60px rgba(0, 245, 212, 0.3)',
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(90deg, #00f5d4, #00bbff)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  borderRadius: '20px',
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
                  color: '#FFD700',
                  fontSize: '11px !important',
                  letterSpacing: '0.5px',
                  marginBottom: '12px !important',
                  textAlign: 'left'
                },
                // Close button - cyan X
                modalCloseButton: {
                  position: 'absolute !important',
                  top: '12px !important',
                  right: '12px !important',
                  backgroundColor: 'transparent !important',
                  color: '#00f5d4 !important',
                  width: '32px !important',
                  height: '32px !important',
                  borderRadius: '6px !important',
                  padding: '0 !important',
                  display: 'flex !important',
                  alignItems: 'center !important',
                  justifyContent: 'center !important',
                  fontSize: '1.5rem !important',
                  fontWeight: 'bold !important',
                  border: 'none !important',
                  boxShadow: 'none !important',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    color: '#00f5d4 !important'
                  }
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #00f5d4, #00bbff)',
                  color: '#000000',
                  fontWeight: '600',
                  fontSize: '14px !important',
                  padding: '12px 24px !important',
                  borderRadius: '50px !important',
                  textTransform: 'none',
                  letterSpacing: '0.5px',
                  border: 'none',
                  boxShadow: '0 2px 15px rgba(0, 245, 212, 0.2)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3)'
                  }
                },
                footerActionLink: {
                  color: '#00f5d4',
                  textDecoration: 'none',
                  textShadow: '0 0 5px rgba(0, 245, 212, 0.5)',
                  '&:hover': {
                    color: '#00bbff',
                    textShadow: '0 0 10px rgba(0, 187, 255, 0.8)'
                  }
                },
                socialButtonsBlockButton: {
                  backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
                  border: '1px solid rgba(0, 245, 212, 0.3) !important',
                  color: '#ffffff !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: 'none !important',
                  borderRadius: '12px !important',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 245, 212, 0.1) !important',
                    borderColor: 'rgba(0, 245, 212, 0.5) !important',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 0 20px rgba(0, 245, 212, 0.2) !important'
                  }
                },
                socialButtonsBlockButtonText: {
                  color: 'inherit !important',
                  fontFamily: '"Georgia", "Times New Roman", serif'
                },
                socialButtonsIconButton: {
                  backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
                  border: '2px solid rgba(255, 215, 0, 0.4) !important',
                  padding: '12px !important',
                  backdropFilter: 'blur(10px) !important',
                  boxShadow: '0 0 15px rgba(255, 215, 0, 0.3) !important',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 215, 0, 0.2) !important',
                    borderColor: '#FFD700 !important',
                    transform: 'scale(1.1)',
                    boxShadow: '0 0 25px rgba(255, 215, 0, 0.5) !important'
                  }
                },
                socialButtonsProviderIcon: {
                  filter: 'brightness(1.2)'
                },
                identityPreviewEditButtonIcon: {
                  color: '#FFD700'
                },
                identityPreviewEditButton: {
                  color: '#FFD700 !important',
                  '&:hover': {
                    color: '#00f5d4 !important'
                  }
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
                  background: 'linear-gradient(90deg, transparent, rgba(0, 245, 212, 0.3), transparent)',
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
                  color: '#00f5d4 !important',
                  fontWeight: '600',
                  fontSize: '11px !important',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                },
                formFieldLabelText: {
                  color: '#00f5d4 !important'
                },
                formFieldSuccessText: {
                  color: '#00f5d4 !important'
                },
                footer: {
                  '& a': {
                    color: '#FFD700'
                  }
                },
                formHeaderTitle: {
                  color: '#ffffff !important'
                },
                formHeaderSubtitle: {
                  color: '#FFD700 !important'
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
                // User profile modal - matching StakeModal style
                // Mobile styles are handled in globals.css with media queries
                userButtonPopoverCard: {
                  backgroundColor: 'rgba(20, 20, 30, 0.98) !important',
                  backdropFilter: 'blur(20px) !important',
                  border: '2px solid transparent !important',
                  backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(90deg, #00f5d4, #00bbff) !important',
                  backgroundOrigin: 'border-box !important',
                  backgroundClip: 'padding-box, border-box !important',
                  borderRadius: '20px !important',
                  boxShadow: '0 20px 60px rgba(0, 245, 212, 0.3) !important',
                  padding: '24px !important',
                  width: '360px !important',
                  maxWidth: 'calc(100vw - 32px) !important',
                  maxHeight: 'calc(100vh - 64px) !important',
                  position: 'relative'
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
                    backgroundColor: 'rgba(0, 245, 212, 0.1) !important',
                    color: '#00f5d4 !important',
                    textShadow: '0 0 10px rgba(0, 245, 212, 0.8) !important'
                  },
                  // Specifically style the sign out button
                  '&[data-localization-key="userButton.action__signOut"]': {
                    color: '#ff6b6b !important',
                    borderTop: '1px solid rgba(255, 107, 107, 0.2) !important',
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
                  backgroundColor: 'rgba(0, 245, 212, 0.05) !important',
                  borderTop: '1px solid rgba(0, 245, 212, 0.2) !important',
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
                  textShadow: 'none !important'
                },
                userPreviewSecondaryIdentifier: {
                  color: '#00f5d4 !important',
                  fontSize: '11px !important'
                },
                // Badge styles
                badge: {
                  background: 'linear-gradient(135deg, #ff69b4, #ff1493) !important',
                  color: '#ffffff !important',
                  borderRadius: '6px !important',
                  padding: '4px 10px !important',
                  fontSize: '10px !important',
                  fontWeight: '700 !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '1px !important',
                  boxShadow: '0 0 15px rgba(255, 105, 180, 0.5) !important'
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
                  background: 'linear-gradient(135deg, #00f5d4, #00bbff) !important',
                  color: '#000000 !important',
                  border: 'none !important',
                  fontWeight: '700 !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '1px !important',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3) !important'
                  }
                },
                // Profile modal specific styles for better visibility
                profileSection: {
                  color: '#ffffff !important',
                  padding: '8px !important',
                  marginBottom: '4px !important'
                },
                profileSectionTitle: {
                  color: '#00f5d4 !important',
                  fontWeight: '700 !important',
                  fontSize: '13px !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '0.5px !important',
                  marginBottom: '8px !important'
                },
                profileSectionTitleText: {
                  color: '#00f5d4 !important'
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
                  borderBottom: '1px solid rgba(0, 245, 212, 0.2) !important',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 245, 212, 0.1) !important',
                    color: '#00f5d4 !important'
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
                  color: '#00f5d4 !important',
                  '&:hover': {
                    backgroundColor: 'transparent !important',
                    transform: 'scale(1.1)'
                  }
                },
                navbarButton: {
                  color: 'rgba(255, 255, 255, 0.8) !important',
                  '&:hover': {
                    color: '#00f5d4 !important'
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
                    backgroundColor: 'rgba(0, 245, 212, 0.4)',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 245, 212, 0.6)'
                    }
                  }
                },
                // Ensure sign out button is visible
                userButtonPopoverActionButtonIcon__signOut: {
                  color: '#ff6b6b !important'
                },
                userButtonPopoverActionButtonText__signOut: {
                  color: '#ff6b6b !important',
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
                navbarMobileMenuButton: {
                  color: '#00f5d4 !important'
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
                  background: 'linear-gradient(135deg, #00f5d4, #00bbff) !important',
                  color: '#000000 !important',
                  border: 'none !important',
                  fontWeight: '700 !important',
                  fontSize: '10px !important',
                  padding: '6px 12px !important',
                  textTransform: 'uppercase !important',
                  letterSpacing: '0.5px !important',
                  marginTop: '8px !important',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3) !important'
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
                },
                // Additional overrides for any remaining pink elements
                formFieldAction: {
                  color: '#00f5d4 !important'
                },
                formFieldAction__password: {
                  color: '#00f5d4 !important'
                },
                otpCodeFieldInput: {
                  borderColor: 'rgba(0, 245, 212, 0.3) !important',
                  '&:focus': {
                    borderColor: '#00f5d4 !important'
                  }
                },
                formFieldInputShowPasswordButton: {
                  color: '#00f5d4 !important'
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