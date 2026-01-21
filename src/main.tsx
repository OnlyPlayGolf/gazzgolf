import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:unhandledrejection',message:'Unhandled promise rejection',data:{reason:event.reason?.message||event.reason,reasonString:String(event.reason)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
});

createRoot(document.getElementById("root")!).render(<App />);
