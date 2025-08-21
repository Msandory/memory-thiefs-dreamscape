import React, { useState, useEffect } from 'react';

export const RotationPrompt = () => {
  const [isPortrait, setIsPortrait] = useState(window.matchMedia("(orientation: portrait)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait)");

    const handleOrientationChange = (e: MediaQueryListEvent) => {
      setIsPortrait(e.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleOrientationChange);

    // Initial check
    setIsPortrait(mediaQuery.matches);
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  if (!isPortrait) {
    return null; // Don't show anything in landscape mode
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[100] flex flex-col items-center justify-center text-white text-center p-4">
      <svg className="w-24 h-24 mb-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.466 7.5C15.643 4.237 13.952 2 12 2 9.239 2 7 6.477 7 12s2.239 10 5 10c.342 0 .677-.069 1-.2" />
        <path d="M20.493 13c.222-1 .334-2.034.334-3.094C20.828 5.906 16.884 2 12 2" />
        <path d="m19 12-2 2-2-2" />
        <path d="M19 16v6" />
        <path d="M22 19h-6" />
      </svg>
      <h2 className="text-2xl font-bold">Please Rotate Your Device</h2>
      <p className="mt-2 text-lg">This experience is best in landscape mode.</p>
    </div>
  );
};