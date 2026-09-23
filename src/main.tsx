import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "@/App";
import { STATIC_HOST } from "@/config";
import "@/styles/tokens.css";
import "@/styles/app.css";

// A static host with no rewrite rule cannot serve /renewals directly, so
// routing moves into the fragment there.
const Router = STATIC_HOST ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      {/* The store is provided by App around the back office only: the landing
          page must paint without generating either side's dataset. */}
      <App />
    </Router>
  </StrictMode>,
);
