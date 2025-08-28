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
  isLoading: boolean; // ✅ 新增：是否正在初始化
};

type AppAction =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "SET_CONVS"; payload: Conversation[] }
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null };

type AppState = {
  user: User;
  conversations: Conversation[];
  currentConv: Conversation | null;
  isLoading: boolean; // ✅ 新增：是否正在初始化
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  console.log("🔁 Reducer 被调用", action.type, "payload:", action.payload);
  console.log("旧 state.user:", state.user);

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

  useEffect(() => {
    console.log("🔍 AppProvider 初始化，尝试恢复登录状态");

    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    console.log("从 localStorage 读取:", { token, username });

    if (token && username) {
      console.log("✅ 检测到登录状态，恢复用户:", { username });
      dispatch({ type: "SET_USER", payload: { username, token } });
    } else {
      console.log("❌ 未检测到登录信息，保持未登录状态");
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