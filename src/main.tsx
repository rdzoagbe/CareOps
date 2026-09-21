import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "@/state/store";
import { App } from "@/App";
import "@/styles/tokens.css";
import "@/styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
