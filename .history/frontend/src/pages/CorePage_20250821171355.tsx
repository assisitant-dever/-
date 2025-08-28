import React from "react";
import Sidebar from "../components/Sidebar";
import Editor from "../components/Editor";
import { useApp } from "../store/app";

export default function CorePage() {
  const { state, dispatch } = useApp();

  const handleSelectConv = (conv: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: conv });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={handleSelectConv} />
      <div className="flex-1 p-4">
        <Editor />
      </div>
    </div>
  );
}
