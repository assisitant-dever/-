import React, { createContext, useReducer, ReactNode, useContext, useEffect } from "react";

// === 类型定义 ===
type Conversation = {
  id: number;
  title: string;
  created_at?: string;
  messages: Message[]; // ✅ 假设你有消息结构
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  docx_file?: string;
  created_at: string;
};

type User = { username: string; token: string } | null;

// ✅ 新增：Action 类型扩展
type AppAction =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "SET_CONVS"; payload: Conversation[] } // 会话列表
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null } // 当前会话
  | { type: "ADD_CONVERSATION"; payload: Conversation } // 新增会话
  | { type: "UPDATE_CONVERSATION"; payload: { id: number; title?: string } } // 修改标题
  | { type: "INIT_COMPLETE" } // 初始化完成
  | { type: "SET_ERROR"; payload: string | null }; // ✅ 可选：错误提示

type AppState = {
  user: User;
  conversations: Conversation[];
  currentConv: Conversation | null;
  isLoading: boolean;
  error: string | null; // ✅ 可选：错误信息
};

// === 初始状态 ===
const initialState: AppState = {
  user: null,
  conversations: [],
  currentConv: null,
  isLoading: true,
  error: null,
};

// === Reducer ===
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
    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [...state.conversations, action.payload],
      };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title || c.title }
            : c
        ),
        currentConv:
          state.currentConv?.id === action.payload.id
            ? { ...state.currentConv, title: action.payload.title || state.currentConv.title }
            : state.currentConv,
      };
    case "INIT_COMPLETE":
      return { ...state, isLoading: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

// === Context ===
type AppContextType = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// === API 工具函数（可抽离）===
const api = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error("加载会话失败");
    return res.json();
  },
};

// === AppProvider ===
export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (token && username) {
      dispatch({ type: "SET_USER", payload: { username, token } });
    }

    // ✅ 1. 加载会话列表
    const loadConversations = async () => {
      try {
        dispatch({ type: "SET_ERROR", payload: null }); // 清除旧错误
        const convs = await api.getConversations();
        dispatch({ type: "SET_CONVS", payload: convs });
      } catch (err: any) {
        console.error("初始化会话失败", err);
        dispatch({ type: "SET_ERROR", payload: err.message });
        // 即使失败，也继续初始化（允许用户新建）
      } finally {
        dispatch({ type: "INIT_COMPLETE" });
      }
    };

    loadConversations();
  }, []);

  // ✅ 可选：渲染错误信息（或静默）
  if (state.isLoading) {
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

// === useApp Hook ===
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};