import React, { createContext, useReducer, ReactNode, useContext } from "react";

type User = { username: string; token: string } | null;

type State = {
  user: User;
};

type Action =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" };

const initialState: State = {
  user: null,
  currentConv: null
};
const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_CONVS":
      return {
        ...state,
        conversations: action.payload,
      };

    case "SET_CURRENT_CONV": // ✅ 加上这一段
      return {
        ...state,
        currentConv: action.payload,
      };

    // 其他 case...

    default:
      return state;
  }
};
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { ...state, user: null };
    default:
      return state;
  }
}

type AppContextType = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

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
