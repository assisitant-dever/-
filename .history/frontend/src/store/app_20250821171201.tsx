import { createContext, useContext, useReducer, ReactNode } from "react";

interface Message { role: string; content: string; filename?: string }
interface Conv { id: number; title: string; messages: Message[] }
interface State {
  user: string | null;
  conversations: Conv[];
  currentConv: Conv | null;
}

type Action =
  | { type: "SET_USER"; payload: string | null }
  | { type: "SET_CONVERSATIONS"; payload: Conv[] }
  | { type: "SET_CURRENT_CONV"; payload: Conv | null }
  | { type: "ADD_MESSAGE"; payload: Message };

const AppContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch(action.type) {
    case "SET_USER": return { ...state, user: action.payload };
    case "SET_CONVERSATIONS": return { ...state, conversations: action.payload };
    case "SET_CURRENT_CONV": return { ...state, currentConv: action.payload };
    case "ADD_MESSAGE":
      if(!state.currentConv) return state;
      return {
        ...state,
        currentConv: {
          ...state.currentConv,
          messages: [...state.currentConv.messages, action.payload]
        }
      };
    default: return state;
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, { user: null, conversations: [], currentConv: null });
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useApp = () => { 
  const context = useContext(AppContext); 
  if(!context) throw new Error("useApp must be used within AppProvider");
  return context; 
};
