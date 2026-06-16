import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";

/**
 * Read-only dashboard entry (PRD §4.6). The UI computes nothing the CLI cannot;
 * it only renders what the read-only API returns.
 */
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root element");
createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
