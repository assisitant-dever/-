import React, { createContext, useReducer, ReactNode, useContext, useEffect } from "react";

// === 类型定义 ===
type Conversation = {
  id: number;
  title: string;
  created_at?: string;
  messages: Message[];
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  docx_file?: string;
  created_at: string;
};

type User = { username: string; token: string } | null;

type AppAction =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "SET_CONVS"; payload: Conversation[] }
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "UPDATE_CONVERSATION"; payload: { id: number; title?: string } }
  | { type: "INIT_COMPLETE" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "DELETE_CONVERSATION"; payload: number };

type AppState = {
  user: User;
  conversations: Conversation[];
  currentConv: Conversation | null;
  isLoadingConvs: boolean;
  isLoadingUser: boolean;
  error: string | null;
};

const initialState: AppState = {
  user: null,
  conversations: [],
  currentConv: null,
  isLoadingConvs: true,
  isLoadingUser: true,
  error: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload, isLoadingUser: false };
    case "LOGOUT":
      return { ...state, user: null, isLoadingUser: false };
    case "SET_CONVS":
      return { ...state, conversations: action.payload, isLoadingConvs: false };
    case "SET_CURRENT_CONV":
      return { ...state, currentConv: action.payload };
    case "ADD_CONVERSATION":
      return { ...state, conversations: [...state.conversations, action.payload] };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id ? { ...c, title: action.payload.title || c.title } : c
        ),
        currentConv:
          state.currentConv?.id === action.payload.id
            ? { ...state.currentConv, title: action.payload.title || state.currentConv.title }
            : state.currentConv,
      };
    case "DELETE_CONVERSATION":
      return { ...state, conversations: state.conversations.filter((c) => c.id !== action.payload) };
    case "INIT_COMPLETE":
      return { ...state, isLoadingConvs: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const api = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error("加载会话失败");
    return res.json();
  },
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (token && username) {
    dispatch({ type: "SET_USER", payload: { username, token } });
  }

  // 仅在用户已登录且有token的情况下加载会话
  const loadConversations = async () => {
    if (!token) {
      // 如果没有token，直接返回，不执行会话加载
      console.log("No token found, skipping conversation load");
      return;
    }

    try {
      dispatch({ type: "SET_ERROR", payload: null });
      const res = await fetch("/api/conversations", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,  // 添加认证信息
        },
      });

      if (!res.ok) {
        throw new Error("加载会话失败");
      }

      const convs = await res.json();
      dispatch({ type: "SET_CONVS", payload: convs });
    } catch (err: any) {
      console.error("初始化会话失败", err);
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "INIT_COMPLETE" });
    }
  };

  // 只有在token存在且user加载后才会执行加载会话
  if (state.user) {
    loadConversations();
  }
}, [state.user]);  // 每次用户信息变更时触发


  if (state.isLoadingUser || state.isLoadingConvs) {
    return <div className="p-4 text-center text-gray-500">加载中，请稍候...</div>;
  }

  if (state.error && !state.conversations.length) {
    return (
      <div className="p-4 text-red-600">
        <p>⚠️ {state.error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-500 underline mt-2"
        >
          重试
        </button>
      </div>
    );
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
