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
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { ...state, user: null };
    case "SET_CONVS":
      return { ...state, conversations: action.payload };
    case "SET_CURRENT_CONV":
      return { ...state, currentConv: action.payload };
    case "INIT_COMPLETE": // ✅ 新增：初始化完成
      return { ...state, isLoading: false };
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
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (token && username) {
      dispatch({ type: "SET_USER", payload: { username, token } });
    }

    // ✅ 恢复状态完成，允许渲染
    dispatch({ type: "INIT_COMPLETE" });
  }, []);

  // ✅ 如果还在初始化，可以显示 loading 或空白
  if (state.isLoading) {
    return <div>加载中...</div>;
  }

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