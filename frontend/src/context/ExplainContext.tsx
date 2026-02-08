import { createContext, useContext, useState } from 'react';

interface ExplainContextType {
  isOpen: boolean;
  openExplain: () => void;
  closeExplain: () => void;
}

const ExplainContext = createContext<ExplainContextType | undefined>(undefined);

export function ExplainProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openExplain = () => setIsOpen(true);
  const closeExplain = () => setIsOpen(false);

  return (
    <ExplainContext.Provider value={{ isOpen, openExplain, closeExplain }}>
      {children}
    </ExplainContext.Provider>
  );
}

export function useExplain() {
  const context = useContext(ExplainContext);
  if (!context) {
    throw new Error('useExplain must be used within ExplainProvider');
  }
  return context;
}
