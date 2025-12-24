"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from '@clerk/themes';

export default function ConditionalClerkProvider({ children }) {
  // Check if we have a publishable key
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // If no key, just return children without Clerk wrapper
  if (!clerkPublishableKey) {
    return children;
  }
  
  // If we have a key, wrap with ClerkProvider
  return (
    <ClerkProvider 
      publishableKey={clerkPublishableKey}
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
      {children}
    </ClerkProvider>
  );
}