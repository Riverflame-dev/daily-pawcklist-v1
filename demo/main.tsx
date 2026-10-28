// Demo entry: same mount as client/src/main.tsx, plus a slim banner that
// says the data is local and offers a reset.

import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../client/src/App";
import "../client/src/theme.css";
import { spaceQueryClient } from "./sdk/client";
import { resetDemoDb } from "./db";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

const bannerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  padding: "6px 12px",
  fontSize: 12,
  fontFamily: "Nunito, system-ui, sans-serif",
  background: "rgba(0, 0, 0, 0.35)",
  color: "#f4f0e1",
};
const linkStyle: CSSProperties = {
  color: "#f4c95d",
  fontWeight: 800,
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  font: "inherit",
};

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div style={bannerStyle}>
        <span>Demo — sample data, saved only in this browser.</span>
        <button type="button" style={linkStyle} onClick={() => resetDemoDb()}>
          Reset
        </button>
        <a style={linkStyle} href="https://github.com/Riverflame-dev/daily-pawcklist-v1" target="_blank" rel="noopener">
          Source
        </a>
      </div>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
