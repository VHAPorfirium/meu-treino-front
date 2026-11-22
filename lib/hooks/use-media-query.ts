'use client';

import { useEffect, useState } from 'react';

/** true quando a media query casa (ex.: '(min-width: 1024px)'). Começa false no servidor. */
export function useMediaQuery(mediaQuery: string): boolean {
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(mediaQuery);
    const updateMatch = () => setIsMatching(mediaQueryList.matches);
    updateMatch();
    mediaQueryList.addEventListener('change', updateMatch);
    return () => mediaQueryList.removeEventListener('change', updateMatch);
  }, [mediaQuery]);

  return isMatching;
}
