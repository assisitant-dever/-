// src/store/app.ts
import { createContext, useReducer, useContext, ReactNode } from "react";

// -------------------- 类型定义 --------------------
type User = {
  username: string;
  token: string;
};

type State = {
  user: User | null;
};

type Action =
  | { type: "SET_USER"; payload: User }
  | { type: "LOGOUT" };

type AppContextType = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

// -------------------- 初始状态 --------------------
const initialState: State = {
  user: null,
};

// -------------------- Reducer --------------------
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

// -------------------- Context --------------------
// ⚠️ 类型断言保证 Provider 的 value 不报错
const AppContext = createContext<AppContextType>({} as AppContextType);

// -------------------- Provider --------------------
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// -------------------- 自定义 Hook --------------------
export function useApp() {
  return useContext(AppContext);
}
