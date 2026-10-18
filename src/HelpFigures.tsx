import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, Dices, EyeOff, FileJson, Folder, Link2, Lock, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { ManaSymbol } from "./components";
import type { Color } from "./domain";
import decks from "./data/decks.json";

// Explanatory figures for Help topics, built from bundled artwork and simplified app controls.
// Numbered callouts match the numbered rules beside each figure.
const grid = (i: number) => decks[i].commanders[0].image;
const art = (i: number) => decks[i].commanders[0].art;
const N = ({ n }: { n: number }) => <span className="hf-n" aria-hidden="true">{n}</span>;
const Pill = ({ state }: { state: "on" | "off" | "some" }) => <span className={`hf-pill hf-pill-${state}`} aria-hidden="true"><span /></span>;
const Mana = ({ colors }: { colors: Color[] }) => <span className="hf-mana">{colors.map(c => <ManaSymbol key={c} color={c} />)}</span>;
const Card = ({ i, className = "" }: { i: number; className?: string }) => <img className={`hf-card ${className}`} src={grid(i)} alt="" />;

export function AddingFigure() {
  return <figure className="hf hf-adding" aria-label="Pasting an Archidekt link previews its folders; subfolders are separate, private decks are skipped, and All formats includes Modern.">
    <div className="hf-input"><Link2 size={15} /><span>archidekt.com/u/your-name</span><ArrowRight size={15} /><N n={1} /></div>
    <div className="hf-tree">
      <div className="hf-row"><span className="hf-box is-on" /><Folder size={14} /><span>Commander</span><small>12 decks</small></div>
      <div className="hf-row hf-indent"><span className="hf-box" /><Folder size={14} /><span>Commander / Precons</span><small>24 decks</small><N n={3} /></div>
      <div className="hf-row hf-skip"><Lock size={14} /><span>Draft ideas · private</span><small>skipped</small><N n={2} /></div>
      <div className="hf-row"><span className="hf-box" /><span className="hf-tag">Modern</span><span>Burn</span><small>All formats</small></div>
    </div>
    <div className="hf-foot"><span className="hf-box is-on" /><span>Show only these folders</span><N n={4} /></div>
  </figure>;
}

export function ShowingFigure() {
  const box = (title: string, i: number[], state: "on" | "off" | "some", extra?: ReactNode, pillNote?: number) => <div className="hf-coll">
    <div className="hf-coll-art">{i.map(n => <img key={n} src={art(n)} alt="" />)}</div>
    <div className="hf-coll-head"><span>{title}</span>{pillNote && <N n={pillNote} />}<Pill state={state} /></div>
    {extra}
  </div>;
  return <figure className="hf hf-showing" aria-label="Collections with on, off and some-folders pills; Only this and the More menu with Hide and Remove; a Hidden list.">
    <div className="hf-colls">
      {box("Your decks", [3, 4, 10, 11], "on", <div className="hf-coll-foot"><span>Only this</span><N n={2} /><MoreHorizontal size={14} /></div>)}
      {box("Precons", [0, 1, 2, 6], "off", <div className="hf-coll-foot"><span>Switched off</span></div>, 1)}
      {box("League", [12, 13, 14, 15], "some", <div className="hf-menu"><span>Hide <N n={3} /></span><span className="hf-danger">Remove… <N n={4} /></span></div>)}
    </div>
    <div className="hf-hidden"><EyeOff size={14} /><span>Hidden</span><small>Old pods · Show</small></div>
  </figure>;
}

export function UpdatesFigure() {
  const tile = (i: number, note: string, extra: ReactNode, n: number) => <div className="hf-tile">
    <Card i={i} />{extra}<small>{note}</small><N n={n} />
  </div>;
  return <figure className="hf hf-updates" aria-label="Refreshing a source: new decks wait as Not added; removed decks keep a saved copy; a single deck can be refreshed from its details.">
    <div className="hf-bar"><span>Your decks</span><span className="hf-btn"><RefreshCw size={13} />Refresh</span><N n={1} /></div>
    <div className="hf-tiles">
      {tile(16, "Not added", <span className="hf-badge"><Plus size={13} /></span>, 2)}
      {tile(17, "No longer listed · saved copy kept", null, 3)}
      {tile(18, "Saved snapshot · Oct 15", <span className="hf-badge"><RefreshCw size={12} /></span>, 4)}
    </div>
  </figure>;
}

export function PickingFigure() {
  return <figure className="hf hf-picking" aria-label="The picker pool narrows from collections that are on, to search and colors, to your shortlist; each deck has an equal chance. Colors include by default; Exact colors matches only that combination.">
    <div className="hf-funnel">
      <div className="hf-stage" style={{ width: "100%" }}><span>Pick format: Commander</span><b>184</b><N n={1} /></div>
      <div className="hf-stage" style={{ width: "74%" }}><span>Search and colors <Mana colors={["U", "B"]} /></span><b>47</b></div>
      <div className="hf-stage is-gold" style={{ width: "48%" }}><span>Your shortlist</span><b>3</b><N n={3} /></div>
      <div className="hf-result"><ArrowDown size={14} /><span className="hf-mini">{[3, 9, 20].map(i => <Card key={i} i={i} />)}</span><span><Dices size={15} /> 1 in 3 each</span><N n={4} /></div>
    </div>
    <div className="hf-colors"><N n={2} />
      <div><small>U + B</small><Mana colors={["U", "B"]} /><Mana colors={["W", "U", "B"]} /><Mana colors={["U", "B", "R"]} /></div>
      <div><small>Exact colors</small><Mana colors={["U", "B"]} /></div>
    </div>
  </figure>;
}

export function SavingFigure() {
  return <figure className="hf hf-saving" aria-label="Export a backup file from one browser and restore it in another; each browser and the Windows app keep their own collection.">
    <div className="hf-flow">
      <div className="hf-device"><span className="hf-dots" /><div className="hf-mini">{[0, 1, 2].map(i => <Card key={i} i={i} />)}</div><small>This browser</small></div>
      <div className="hf-arrow"><small>Export</small><ArrowRight size={16} /><N n={2} /></div>
      <div className="hf-file"><FileJson size={22} /><small>deckshelf-collection.json</small></div>
      <div className="hf-arrow"><small>Restore</small><ArrowRight size={16} /><N n={3} /></div>
      <div className="hf-device hf-phone"><div className="hf-mini">{[0, 1, 2].map(i => <Card key={i} i={i} />)}</div><small>Phone</small></div>
    </div>
    <div className="hf-places"><N n={1} />{["Another browser", "Windows app", "localhost"].map(p => <span key={p}>{p} · own shelf</span>)}</div>
  </figure>;
}

export function FeaturesPreview() {
  return <div className="hf-mosaic">{[0, 1, 2, 3].map(i => <img key={i} src={art(i)} alt="" />)}</div>;
}
export function RoadmapPreview() {
  return <div className="hf-road"><span className="is-next" /><span className="is-later" /><span className="is-exploring" />
    <small>Next</small><small>Later</small><small>Exploring</small></div>;
}
export function AboutPreview() {
  return <div className="hf-about"><img className="hf-mark" src="/brand-familiar.svg" alt="" />
    <div className="hf-fan">{[5, 7, 8].map(i => <Card key={i} i={i} />)}</div></div>;
}
