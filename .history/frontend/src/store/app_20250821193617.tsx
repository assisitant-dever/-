import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./store/app";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import CorePage from "./pages/CorePage";

// 🔹 内部定义 PrivateRoute
function PrivateRoute({ children }: { children: JSX.Element }) {
  const { state } = useApp();
  return state.user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* 受保护路由 */}
          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/core/:id" element={<PrivateRoute><CorePage /></PrivateRoute>} />

          {/* 默认跳转 */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}
