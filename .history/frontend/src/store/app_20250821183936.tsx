import { createContext, useContext, useReducer } from "react";

const initialState = {
  conversations: [] as any[],
  currentConv: null as any | null,
};

type Action =
  | { type: "SET_CONVS"; payload: any[] }
  | { type: "SET_CURRENT_CONV"; payload: any }
  | { type: "UPDATE_CONV_MESSAGE"; payload: any };

function reducer(state: typeof initialState, action: Action) {
  switch (action.type) {
    case "SET_CONVS":
      return { ...state, conversations: action.payload };
    case "SET_CURRENT_CONV":
      return { ...state, currentConv: action.payload };
    case "UPDATE_CONV_MESSAGE":
      return {
        ...state,
        currentConv: {
          ...state.currentConv,
          messages: [...state.currentConv.messages, action.payload],
        },
        conversations: state.conversations.map((c) =>
          c.id === state.currentConv.id
            ? { ...c, messages: [...c.messages, action.payload] }
            : c
        ),
      };
    default:
      return state;
  }
}

const AppContext = createContext({ state: initialState, dispatch: () => {} } as any);

export const AppProvider = ({ children }: any) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>

  );
};

export const useApp = () => useContext(AppContext);
