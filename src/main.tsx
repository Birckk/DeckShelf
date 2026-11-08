import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "./layout.css";
import "./styles.css";
import "./focus.css";
import "./helix.css";
import "./studio.css";
import "./picker-players.css";
import App from "./App";
import { COLLECTION_KEY } from "./firstVisit";
import { loadPrecons } from "./precons";
import { trackFocusInput } from "./focusInput";
import { registerServiceWorker } from "./pwa";
import { clearRetiredKeys } from "./retiredKeys";
import { WindowBar } from "./WindowBar";
import { CrashBoundary, CrashProbe } from "./CrashScreen";

try { clearRetiredKeys(localStorage); } catch { /* Reading localStorage itself can throw when storage is blocked. */ }

trackFocusInput();

// A new shelf starts with the precons, so load them before the first render.
let saved: string | null = "";
try { saved = localStorage.getItem(COLLECTION_KEY); } catch { /* App reports blocked storage. */ }
if (saved === null) await loadPrecons();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WindowBar />
    <CrashBoundary>
      <CrashProbe />
      <App />
    </CrashBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
