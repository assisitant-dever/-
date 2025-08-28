// src/store/app.tsx
import { createContext, useReducer, useContext, useEffect, ReactNode } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: number;
  title: string;
  messages: any[];
}

interface AppState {
  conversations: Conversation[];
  currentConv: Conversation | null;
}

type AppAction =
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "UPDATE_CONVERSATION"; payload: { id: number; title?: string } }
  | { type: "SET_CURRENT_CONV"; payload: Conversation | null }
  | { type: "CLEAR_CONVERSATIONS" };

const initialState: AppState = {
  conversations: [],
  currentConv: null,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };
    case "ADD_CONVERSATION":
      return { ...state, conversations: [...state.conversations, action.payload] };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title || c.title }
            : c
        ),
      };
    case "SET_CURRENT_CONV":
      return { ...state, currentConv: action.payload };
    case "CLEAR_CONVERSATIONS":
      return { ...state, conversations: [], currentConv: null };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // ✅ 启动时从后端加载 conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await api.get("/api/conversations"); // 👈 新增后端接口
        dispatch({ type: "SET_CONVERSATIONS", payload: res.data });
      } catch (err) {
        console.error("加载会话失败", err);
      }
    };
    loadConversations();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}