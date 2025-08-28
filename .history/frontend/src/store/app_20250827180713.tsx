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

type ApiKeyConfig = {
  id: string;
  model: string;
  platform: string;
  apiKey: string;
};


type AppState = {
  user: User;
  conversations: Conversation[];
  currentConv: Conversation | null;
  isLoadingConvs: boolean;
  isLoadingUser: boolean;
  error: string | null;
  apiKeyConfigs: ApiKeyConfig[];  // 新增
  currentApiKeyConfig: ApiKeyConfig | null;  // 当前选中的 API 配置
};

const initialState: AppState = {
  user: null,
  conversations: [],
  currentConv: null,
  isLoadingConvs: false,
  isLoadingUser: false,
  error: null,
  apiKeyConfigs: [],  // 初始化为空
  currentApiKeyConfig: null,  // 默认没有选中的配置
};

type AppAction =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "SET_CONVS"; payload: Conversation[] }
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "UPDATE_CONVERSATION"; payload: { id: number; title?: string } }
  | { type: "INIT_COMPLETE" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "DELETE_CONVERSATION"; payload: number }
  | { type: "SET_API_KEY_CONFIGS"; payload: ApiKeyConfig[] }  // 新增 action
  | { type: "SET_CURRENT_API_KEY_CONFIG"; payload: ApiKeyConfig | null };  // 新增 action

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
    case "SET_API_KEY_CONFIGS":  // 新增 case
      return { ...state, apiKeyConfigs: action.payload };
    case "SET_CURRENT_API_KEY_CONFIG":  // 新增 case
      return { ...state, currentApiKeyConfig: action.payload };
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
generateTitle: async (conversationId: number): Promise<string> => {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/conversations/${conversationId}/generate_title`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error("生成标题失败");
    const data = await res.json();
    return data.title;
  },
};


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // 如果有 token 和 username，设置用户信息
    if (token && username) {
      dispatch({ type: "SET_USER", payload: { username, token } });
    }

    // 只有 token 存在时才加载会话
    const loadConversations = async () => {
      if (!token) {
        console.log("No token found, skipping conversation load");
        return;
      }

      try {
        dispatch({ type: "SET_ERROR", payload: null });
        const res = await fetch("/api/conversations", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          dispatch({ type: "LOGOUT" });
          dispatch({ type: "SET_ERROR", payload: "登录已过期，请重新登录" });
          return;
        }
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

    loadConversations();

    // 加载 API 配置信息
    const savedApiKeyConfigs = JSON.parse(localStorage.getItem('apiKeyConfigs') || '[]');
    dispatch({ type: "SET_API_KEY_CONFIGS", payload: savedApiKeyConfigs });

  }, []);  // 只在组件加载时执行一次

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
