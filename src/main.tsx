import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { StoreProvider } from "@/state/store";
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
      <StoreProvider>
        <App />
      </StoreProvider>
    </Router>
  </StrictMode>,
);
