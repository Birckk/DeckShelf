import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { parseCollection } from "./domain";
import { COLLECTION_KEY } from "./firstVisit";
import "./crash.css";

type Saved = { kind: "backup" | "recovery"; text: string } | null;

// Reads the saved collection straight from storage, so it works however broken the app is.
function readSaved(): Saved {
  let raw: string | null;
  try { raw = localStorage.getItem(COLLECTION_KEY); } catch { return null; }
  if (raw === null) return null;
  try { return { kind: "backup", text: JSON.stringify(parseCollection(raw), null, 2) }; }
  catch { return { kind: "recovery", text: raw }; }
}

function download(saved: NonNullable<Saved>) {
  const url = URL.createObjectURL(new Blob([saved.text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = saved.kind === "backup" ? "deckshelf-collection.json" : "deckshelf-recovery-data.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function CrashScreen() {
  const heading = useRef<HTMLHeadingElement>(null);
  const [saved] = useState(readSaved);
  const [done, setDone] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <main className="crash-screen">
      <div className="crash-panel">
        <h1 ref={heading} tabIndex={-1}>DeckShelf stopped working</h1>
        <p>
          Something went wrong and this page can't continue.{" "}
          {saved ? "Your collection is still saved in this browser." : "No saved collection was found in this browser."}{" "}
          Reloading usually fixes it.
        </p>
        {saved?.kind === "recovery" && <p>The saved data looks damaged. The download keeps it exactly as it is, for repair.</p>}
        <div className="crash-actions">
          <button type="button" className="crash-primary" onClick={() => location.reload()}>Reload</button>
          {saved && (
            <button type="button" onClick={() => { download(saved); setDone(true); }}>
              {saved.kind === "backup" ? "Export backup" : "Download recovery data"}
            </button>
          )}
        </div>
        <p className="crash-status" role="status">{done ? "Downloaded. Keep the file until DeckShelf works again." : ""}</p>
      </div>
    </main>
  );
}

// A render error anywhere below shows CrashScreen instead of a blank page (#156).
export class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: unknown) { console.error("DeckShelf crashed:", error); }
  render() { return this.state.crashed ? <CrashScreen /> : this.props.children; }
}

// Development builds crash on purpose with ?crash-test, so tests can reach the screen.
export function CrashProbe() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("crash-test")) throw new Error("Test crash");
  return null;
}
