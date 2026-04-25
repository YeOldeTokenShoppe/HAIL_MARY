'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { CDPReactProvider } from '@coinbase/cdp-react';
import { wagmiConfig, cdpEmbeddedWalletConfig } from '@/lib/wagmiConfig';

// Theme matched to BuyModal: purple/magenta bg, yellow accents, green CTA.
const cdpTheme = {
  'colors-bg-default': '#4a1f6a',
  'colors-bg-alternate': '#5e2a82',
  'colors-bg-primary': '#00e572',
  'colors-bg-secondary': '#5e2a82',
  'colors-fg-default': '#ffffff',
  'colors-fg-muted': 'rgba(255, 255, 255, 0.6)',
  'colors-fg-primary': '#fded00',
  'colors-fg-onPrimary': '#000000',
  'colors-fg-onSecondary': '#ffffff',
  'colors-fg-positive': '#00e572',
  'colors-fg-negative': '#ff184c',
  'colors-fg-warning': '#ffb700',
  'colors-line-default': 'rgba(253, 237, 0, 0.3)',
  'colors-line-heavy': 'rgba(253, 237, 0, 0.5)',
  // OAuth buttons (Google/Apple/X) use the secondary variant — dark bg + gold text + gold border (border via globals.css).
  'colors-cta-secondary-bg-default': '#2a1240',
  'colors-cta-secondary-text-default': '#fded00',
  'colors-cta-secondary-text-hover': '#fded00',
  'borderRadius-banner': 'var(--cdp-web-borderRadius-xl)',
  'borderRadius-cta': 'var(--cdp-web-borderRadius-full)',
  'borderRadius-link': 'var(--cdp-web-borderRadius-full)',
  'borderRadius-input': 'var(--cdp-web-borderRadius-lg)',
  'borderRadius-select-trigger': 'var(--cdp-web-borderRadius-lg)',
  'borderRadius-select-list': 'var(--cdp-web-borderRadius-lg)',
  'borderRadius-modal': 'var(--cdp-web-borderRadius-xl)',
  // BuyModal sits at z-index 10000; CDP modal must sit above it.
  'zIndex-modal-overlay': '10010',
  'zIndex-modal-dialog': '10011',
};
import { WalletAuthProvider } from '@/components/WalletAuthProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import { MusicProvider } from '@/components/MusicContext';

const queryClient = new QueryClient();

// Clerk appearance config extracted from layout.js
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#00f5d4',
    colorBackground: 'rgba(0, 0, 0, 0.95)',
    colorInputBackground: 'rgba(26, 26, 46, 0.8)',
    colorInputText: '#ffffff',
    colorText: '#ffffff',
    colorTextOnPrimaryBackground: '#000000',
    colorTextSecondary: '#00f5d4',
    colorDanger: '#ff6b6b',
    colorSuccess: '#00ff88',
    colorWarning: '#ffb700',
    colorNeutral: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '0.75rem',
    fontFamily: '"Orbitron", monospace',
    fontFamilyButtons: '"Orbitron", monospace',
    fontSize: '13px',
    spacingUnit: '12px',
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  elements: {
    card: {
      backgroundColor: 'rgba(20, 20, 30, 0.98)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 60px rgba(0, 245, 212, 0.3)',
      border: '2px solid transparent',
      backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(90deg, #00f5d4, #00bbff)',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      borderRadius: '20px !important',
      padding: '20px',
      width: '400px !important',
      maxWidth: '90vw',
      maxHeight: '85vh !important',
      overflow: 'hidden !important',
      position: 'relative',
    },
    rootBox: { width: '100%', maxWidth: '400px !important', margin: '0 auto' },
    modalContent: { width: '100%', maxWidth: '400px !important', maxHeight: '85vh !important', overflow: 'auto !important' },
    header: { padding: '0 0 16px 0 !important' },
    headerTitle: {
      color: '#ffffff', fontWeight: '700', fontSize: '18px !important',
      textShadow: '0 0 20px rgba(255, 255, 255, 0.6)', textTransform: 'uppercase',
      letterSpacing: '2px', marginBottom: '8px !important', textAlign: 'left',
    },
    headerSubtitle: { color: '#FFD700', fontSize: '11px !important', letterSpacing: '0.5px', marginBottom: '12px !important', textAlign: 'center' },
    modalCloseButton: {
      position: 'absolute !important', top: '12px !important', right: '12px !important',
      backgroundColor: 'transparent !important', color: '#00f5d4 !important',
      width: '32px !important', height: '32px !important', borderRadius: '6px !important',
      padding: '0 !important', display: 'flex !important', alignItems: 'center !important',
      justifyContent: 'center !important', fontSize: '1.5rem !important', fontWeight: 'bold !important',
      border: 'none !important', boxShadow: 'none !important',
      '&:hover': { transform: 'scale(1.1)', color: '#00f5d4 !important' },
    },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #00f5d4, #00bbff)', color: '#000000',
      fontWeight: '600', fontSize: '14px !important', padding: '12px 24px !important',
      borderRadius: '50px !important', textTransform: 'none', letterSpacing: '0.5px',
      border: 'none', boxShadow: '0 2px 15px rgba(0, 245, 212, 0.2)', transition: 'all 0.3s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3)' },
    },
    footerActionLink: {
      color: '#00f5d4', textDecoration: 'none', textShadow: '0 0 5px rgba(0, 245, 212, 0.5)',
      '&:hover': { color: '#00bbff', textShadow: '0 0 10px rgba(0, 187, 255, 0.8)' },
    },
    socialButtonsRoot: { paddingTop: '12px !important', paddingRight: '12px !important', overflow: 'visible !important' },
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.6) !important', border: '1px solid rgba(0, 245, 212, 0.3) !important',
      color: '#ffffff !important', padding: '12px !important', backdropFilter: 'blur(10px) !important',
      boxShadow: 'none !important', borderRadius: '12px !important', transition: 'all 0.2s ease',
      position: 'relative !important', overflow: 'visible !important', marginTop: '4px !important',
      '&:hover': { backgroundColor: 'rgba(0, 245, 212, 0.1) !important', borderColor: 'rgba(0, 245, 212, 0.5) !important', transform: 'translateY(-2px)', boxShadow: '0 0 20px rgba(0, 245, 212, 0.2) !important' },
    },
    socialButtonsBlockButtonText: { color: 'inherit !important', fontFamily: '"Georgia", "Times New Roman", serif' },
    socialButtonsIconButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.6) !important', border: '2px solid rgba(255, 215, 0, 0.4) !important',
      padding: '12px !important', backdropFilter: 'blur(10px) !important', boxShadow: '0 0 15px rgba(255, 215, 0, 0.3) !important',
      '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.2) !important', borderColor: '#FFD700 !important', transform: 'scale(1.1)', boxShadow: '0 0 25px rgba(255, 215, 0, 0.5) !important' },
    },
    socialButtonsProviderIcon: { filter: 'brightness(1.2)' },
    identityPreviewEditButtonIcon: { color: '#FFD700' },
    identityPreviewEditButton: { color: '#FFD700 !important', '&:hover': { color: '#00f5d4 !important' } },
    formFieldInput: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)', borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: '1px', borderRadius: '8px !important', color: '#ffffff', fontSize: '13px',
      padding: '10px 12px !important', transition: 'all 0.2s ease',
      '&:focus': { borderColor: '#00f5d4', backgroundColor: 'rgba(0, 0, 0, 0.8)', boxShadow: '0 0 0 1px #00f5d4, 0 0 15px rgba(0, 245, 212, 0.2)' },
      '&:hover': { borderColor: 'rgba(0, 245, 212, 0.2)' },
    },
    formFieldRow: { gap: '4px !important', marginBottom: '8px !important' },
    formFieldLabelRow: { marginBottom: '2px !important', padding: '0 !important' },
    dividerLine: { background: 'linear-gradient(90deg, transparent, rgba(0, 245, 212, 0.3), transparent)', margin: '16px 0 !important' },
    dividerText: { color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px !important' },
    dividerRow: { margin: '16px 0 !important' },
    formFieldLabel: { color: '#00f5d4 !important', fontWeight: '600', fontSize: '11px !important', textTransform: 'uppercase', letterSpacing: '0.5px' },
    formFieldLabelText: { color: '#00f5d4 !important' },
    formFieldSuccessText: { color: '#00f5d4 !important' },
    footer: { padding: '16px 20px !important', marginTop: '12px !important', backgroundColor: 'rgba(15, 15, 25, 0.9) !important', borderBottomLeftRadius: '18px !important', borderBottomRightRadius: '18px !important', marginLeft: '-20px !important', marginRight: '-20px !important', marginBottom: '-20px !important', width: 'calc(100% + 40px) !important', borderTop: '1px solid rgba(0, 245, 212, 0.2) !important', '& a': { color: '#FFD700', fontSize: '11px !important' } },
    formHeaderTitle: { color: '#ffffff !important' },
    formHeaderSubtitle: { color: '#FFD700 !important', textAlign: 'center' },
    userButtonBox: { backgroundColor: 'transparent !important', border: 'none !important', boxShadow: 'none !important' },
    userButtonTrigger: { border: 'none !important', boxShadow: 'none !important', '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.2s ease' } },
    userButtonPopoverCard: {
      backgroundColor: 'rgba(20, 20, 30, 0.98) !important', backdropFilter: 'blur(20px) !important',
      border: '2px solid transparent !important',
      backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(90deg, #00f5d4, #00bbff) !important',
      backgroundOrigin: 'border-box !important', backgroundClip: 'padding-box, border-box !important',
      borderRadius: '20px !important', boxShadow: '0 20px 60px rgba(0, 245, 212, 0.3) !important',
      padding: '24px !important', width: '360px !important', maxWidth: 'calc(100vw - 32px) !important',
      maxHeight: 'calc(100vh - 64px) !important', position: 'relative',
    },
    userButtonPopoverActions: { backgroundColor: 'transparent !important', padding: '8px !important', gap: '4px !important' },
    userButtonPopoverActionButton: {
      color: 'rgba(255, 255, 255, 0.8) !important', padding: '8px 12px !important', fontSize: '12px !important',
      transition: 'all 0.2s ease',
      '&:hover': { backgroundColor: 'rgba(0, 245, 212, 0.1) !important', color: '#00f5d4 !important', textShadow: '0 0 10px rgba(0, 245, 212, 0.8) !important' },
      '&[data-localization-key="userButton.action__signOut"]': { color: '#ff6b6b !important', borderTop: '1px solid rgba(255, 107, 107, 0.2) !important', marginTop: '8px !important', paddingTop: '12px !important' },
    },
    userButtonPopoverActionButtonText: { color: 'inherit !important' },
    userButtonPopoverActionButtonIcon: { color: '#00f5d4 !important' },
    userButtonPopoverFooter: { backgroundColor: 'rgba(0, 245, 212, 0.05) !important', borderTop: '1px solid rgba(0, 245, 212, 0.2) !important', padding: '8px 12px !important', marginTop: '8px !important' },
    avatarBox: { width: '60px !important', height: '60px !important', backgroundColor: 'transparent !important', border: '2px solid #00f5d4 !important', boxShadow: '0 0 20px rgba(0, 245, 212, 0.4) !important' },
    userPreviewMainIdentifier: { color: '#ffffff !important', fontWeight: '700 !important', fontSize: '13px !important', textShadow: 'none !important' },
    userPreviewSecondaryIdentifier: { color: '#00f5d4 !important', fontSize: '11px !important' },
    badge: { background: 'linear-gradient(135deg, #ff69b4, #ff1493) !important', color: '#ffffff !important', borderRadius: '6px !important', padding: '4px 8px !important', fontSize: '9px !important', fontWeight: '700 !important', textTransform: 'uppercase !important', letterSpacing: '0.5px !important', boxShadow: '0 0 15px rgba(255, 105, 180, 0.5) !important', marginRight: '4px !important' },
    userButtonAvatarBox: { '&[data-illumin80="true"]': { border: '3px solid #FFD700 !important', boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), inset 0 0 10px rgba(255, 215, 0, 0.3) !important', animation: 'illumin80Pulse 3s ease-in-out infinite' } },
    profileSectionPrimaryButton: { background: 'linear-gradient(135deg, #00f5d4, #00bbff) !important', color: '#000000 !important', border: 'none !important', fontWeight: '700 !important', fontSize: '10px !important', padding: '6px 12px !important', textTransform: 'uppercase !important', letterSpacing: '0.5px !important', marginTop: '8px !important', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3) !important' } },
    profileSection: { color: '#ffffff !important', padding: '8px !important', marginBottom: '4px !important' },
    profileSectionTitle: { color: '#00f5d4 !important', fontWeight: '700 !important', fontSize: '13px !important', textTransform: 'uppercase !important', letterSpacing: '0.5px !important', marginBottom: '8px !important' },
    profileSectionTitleText: { color: '#00f5d4 !important' },
    profileSectionContent: { color: '#ffffff !important', overflowX: 'hidden !important', wordBreak: 'break-word !important' },
    profileSectionItem: { color: '#ffffff !important' },
    profileSectionItemText: { color: '#ffffff !important' },
    profileSectionItemSubText: { color: '#00f5d4 !important' },
    accordionTriggerButton: { color: '#ffffff !important', padding: '8px 12px !important', fontSize: '12px !important', borderBottom: '1px solid rgba(0, 245, 212, 0.2) !important', '&:hover': { backgroundColor: 'rgba(0, 245, 212, 0.1) !important', color: '#00f5d4 !important' } },
    accordionContent: { color: '#ffffff !important' },
    navbarButton: { color: 'rgba(255, 255, 255, 0.8) !important', '&:hover': { color: '#00f5d4 !important' } },
    navbarButtonIcon: { color: '#00f5d4 !important' },
    userButtonPopoverActionButtonIcon__signOut: { color: '#ff6b6b !important' },
    userButtonPopoverActionButtonText__signOut: { color: '#ff6b6b !important', fontWeight: '600 !important' },
    userPreview: { padding: '12px !important', gap: '8px !important' },
    userButtonPopoverMain: { padding: '0 !important' },
    rootBox: { width: '100% !important', height: '100% !important', display: 'flex !important', alignItems: 'center !important', justifyContent: 'center !important' },
    cardBox: { width: '360px !important', maxWidth: '90vw !important', maxHeight: '80vh !important', margin: '0 auto !important', position: 'relative !important', left: 'auto !important', right: 'auto !important', transform: 'none !important', overflow: 'hidden !important', borderRadius: '20px !important' },
    footerRoot: { backgroundColor: 'rgba(15, 15, 25, 0.95) !important', borderBottomLeftRadius: '20px !important', borderBottomRightRadius: '20px !important', overflow: 'hidden !important' },
    navbar: { padding: '8px 12px !important', minHeight: 'auto !important' },
    navbarMobileMenuButton: { color: '#00f5d4 !important' },
    navbarMobileMenuRow: { minHeight: 'auto !important', padding: '4px !important' },
    pageScrollBox: { padding: '12px !important', overflowX: 'hidden !important', overflowY: 'auto !important' },
    scrollBox: { overflowX: 'hidden !important', padding: '0 !important' },
    profilePage: { gap: '12px !important' },
    formField: { marginBottom: '8px !important' },
    formButtonReset: { fontSize: '11px !important', padding: '6px 12px !important' },
    formResendCodeLink: { fontSize: '11px !important' },
    main: { overflowX: 'hidden !important', width: '100% !important' },
    avatarImageElementContainer: { width: '60px !important', height: '60px !important' },
    footerActionText: { color: 'rgba(255, 255, 255, 0.7) !important', fontSize: '11px !important' },
    formFieldAction: { color: '#00f5d4 !important' },
    formFieldAction__password: { color: '#00f5d4 !important' },
    otpCodeFieldInput: { borderColor: 'rgba(0, 245, 212, 0.3) !important', '&:focus': { borderColor: '#00f5d4 !important' } },
    formFieldInputShowPasswordButton: { color: '#00f5d4 !important' },
  },
};

export default function Providers({ children }) {
  return (
    <CDPReactProvider config={cdpEmbeddedWalletConfig} theme={cdpTheme}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ClerkProvider appearance={clerkAppearance}>
            <WalletAuthProvider>
              <LanguageProvider>
                <MusicProvider>
                  {children}
                </MusicProvider>
              </LanguageProvider>
            </WalletAuthProvider>
          </ClerkProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </CDPReactProvider>
  );
}
