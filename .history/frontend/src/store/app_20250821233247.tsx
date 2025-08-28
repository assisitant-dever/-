import React, { createContext, useReducer, ReactNode, useContext, useEffect } from "react";

type Conversation = {
  id: number;
  title: string;
  created_at?: string;
};

type User = { username: string; token: string } | null;

type AppState = {
  user: User;
  conversations: Conversation[];
  currentConv: Conversation | null;
};

type AppAction =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "SET_CONVS"; payload: Conversation[] }
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null };

const initialState: AppState = {
  user: null,
  conversations: [],
  currentConv: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { ...state, user: null, conversations: [], currentConv: null };
    case "SET_CONVS":
      return { ...state, conversations: action.payload };
    case "SET_CURRENT_CONV":
      return { ...state, currentConv: action.payload };
    default:
      return state;
  }
};

type AppContextType = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // ✅ 应用启动时从 localStorage 恢复用户状态
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (token && username) {
      dispatch({
        type: "SET_USER",
        payload: { username, token },
      });
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};