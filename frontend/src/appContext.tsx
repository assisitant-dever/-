import React, { createContext, useContext, useState, ReactNode } from "react";

interface AppState {
  currentConv: any | null;
  conversations: any[];
}

interface AppContextType extends AppState {
  setCurrentConv: (conv: any) => void;
  setConversations: (convs: any[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentConv, setCurrentConv] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  return (
    <AppContext.Provider
      value={{ currentConv, setCurrentConv, conversations, setConversations }}
    >
      {children}
    </AppContext.Provider>
  );
};

// 自定义 Hook
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
