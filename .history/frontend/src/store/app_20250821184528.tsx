// src/store/app.tsx
import React, { createContext, useReducer, useContext, ReactNode } from "react";

// ----------------- 类型定义 -----------------
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  docx_file?: string;
  created_at: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
  created_at: string;
}

interface AppState {
  conversations: Conversation[];
  currentConv: Conversation | null;
}

type Action =
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "SET_CURRENT_CONV"; payload: Conversation }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "UPDATE_CONVERSATION"; payload: Conversation }
  | { type: "ADD_MESSAGE"; payload: { convId: number; message: Message } };

// ----------------- 初始状态 -----------------
const initialState: AppState = {
  conversations: [],
  currentConv: null,
};

// ----------------- Reducer -----------------
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
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
          c.id === action.payload.id ? action.payload : c
        ),
        currentConv:
          state.currentConv?.id === action.payload.id
            ? action.payload
            : state.currentConv,
      };
    case "ADD_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.convId
            ? { ...c, messages: [...c.messages, action.payload.message] }
            : c
        ),
        currentConv:
          state.currentConv?.id === action.payload.convId
            ? {
                ...state.currentConv,
                messages: [
                  ...state.currentConv.messages,
                  action.payload.message,
                ],
              }
            : state.currentConv,
      };
    default:
      return state;
  }
}

// ----------------- Context -----------------
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

// ----------------- Provider -----------------
export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// ----------------- Hook -----------------
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
