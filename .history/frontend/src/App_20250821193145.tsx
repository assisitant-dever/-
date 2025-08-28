import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./store/app";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import CorePage from "./pages/CorePage";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { state } = useApp();
  return state.user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/core" element={<PrivateRoute><CorePage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/home" />} />
        <Route path="/conv/:id" element={<CorePage />} />
      </Routes>
    </AppProvider>
  );
}
