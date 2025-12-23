import { useEffect, useState } from 'react';

export const useFontLoader = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Start with fonts not loaded
    let fontLoadTimeout;
    
    const markFontsLoaded = () => {
      setFontsLoaded(true);
      document.documentElement.classList.add('fonts-loaded');
      document.body.classList.add('fonts-loaded');
      if (fontLoadTimeout) clearTimeout(fontLoadTimeout);
    };

    // Check if Font Loading API is available
    if ('fonts' in document) {
      // Try to load the specific fonts we need
      Promise.all([
        document.fonts.load('normal 1rem UnifrakturMaguntia'),
        document.fonts.load('normal 1rem UnifrakturCook'),
      ]).then(() => {
        markFontsLoaded();
      }).catch(() => {
        // If specific fonts fail, wait for any fonts to be ready
        document.fonts.ready.then(() => {
          markFontsLoaded();
        });
      });

      // Also set up the general ready check
      document.fonts.ready.then(() => {
        markFontsLoaded();
      });
    }

    // Fallback timeout - show content after 300ms regardless
    fontLoadTimeout = setTimeout(() => {
      markFontsLoaded();
    }, 300);

    return () => {
      if (fontLoadTimeout) clearTimeout(fontLoadTimeout);
    };
  }, []);

  return fontsLoaded;
};