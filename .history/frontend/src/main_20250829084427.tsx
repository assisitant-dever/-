console.log('入口文件读取的环境变量:', import.meta.env.VITE_API_URL);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AppProvider } from "./store/app";
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
        <App />

    </AppProvider>
  </React.StrictMode>
);
