import React, { createContext, useReducer, useContext, ReactNode } from "react";

// ----------------- 类型 -----------------
interface User {
  username: string;
  token: string;
}

interface State {
  user: User | null;
}

type Action = { type: "SET_USER"; payload: User } | { type: "LOGOUT" };

interface AppContextType {
  state: State;
  dispatch: React.Dispatch<Action>;
}

// ----------------- 初始化 -----------------
const initialState: State = {
  user: localStorage.getItem("token")
    ? {
        username: localStorage.getItem("username") || "",
        token: localStorage.getItem("token") || "",
      }
    : null,
};

// ----------------- Reducer -----------------
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { ...state, user: null };
    default:
      return state;
  }
}

// ----------------- Context -----------------
const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// ----------------- Hook -----------------
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
