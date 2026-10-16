import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "./styles.css";
import "./helix.css";
import "./studio.css";
import "./picker-players.css";
import App from "./App";
import { registerServiceWorker } from "./pwa";
import { WindowBar } from "./WindowBar";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WindowBar />
    <App />
  </React.StrictMode>,
);

registerServiceWorker();
