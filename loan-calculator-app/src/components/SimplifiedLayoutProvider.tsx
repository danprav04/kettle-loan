// src/components/SimplifiedLayoutProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, Dispatch, SetStateAction } from 'react';

type SimplifiedLayout = boolean;

interface SimplifiedLayoutContextType {
  isSimplified: SimplifiedLayout;
  setIsSimplified: Dispatch<SetStateAction<SimplifiedLayout>>;
}

const SimplifiedLayoutContext = createContext<SimplifiedLayoutContextType | undefined>(undefined);

export default function SimplifiedLayoutProvider({ children }: { children: ReactNode }) {
  const [isSimplified, setIsSimplified] = useState<SimplifiedLayout>(false);

  // On initial client-side render, load the state from localStorage
  useEffect(() => {
    const storedValue = localStorage.getItem('simplifiedLayout');
    if (storedValue) {
      setIsSimplified(JSON.parse(storedValue));
    }
  }, []);

  // When state changes, update localStorage
  useEffect(() => {
    localStorage.setItem('simplifiedLayout', JSON.stringify(isSimplified));
  }, [isSimplified]);

  return (
    <SimplifiedLayoutContext.Provider value={{ isSimplified, setIsSimplified }}>
      {children}
    </SimplifiedLayoutContext.Provider>
  );
}

export function useSimplifiedLayout() {
  const context = useContext(SimplifiedLayoutContext);
  if (context === undefined) {
    throw new Error('useSimplifiedLayout must be used within a SimplifiedLayoutProvider');
  }
  return context;
}