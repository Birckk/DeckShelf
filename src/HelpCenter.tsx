import { useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, Dices, Eye, ExternalLink, Folder, FolderOpen, HardDrive,
  HardDriveDownload, Info, LayoutGrid, Library, Link2, ListChecks, Map as MapIcon, Menu, MessageCircleQuestion, Puzzle,
  RefreshCw, Search, X,
} from "lucide-react";
import { CardFanIcon } from "./CardFanIcon";
import CollectionGuide from "./CollectionGuide";
import decks from "./data/decks.json";
import { roadmap, roadmapStages } from "./data/roadmap";
import { AboutPreview, AddingFigure, FeaturesPreview, PickingFigure, RoadmapPreview, SavingFigure, ShowingFigure, UpdatesFigure } from "./HelpFigures";

type Icon = ComponentType<{ size?: number }>;
// Groups are folders in the navigation with their own overview page; the rest are topics.
export const helpSections = [
  { id: "start", label: "Start here", Icon: BookOpen, summary: "A three-page visual tour." },
  { id: "core", label: "Core", Icon: Folder, group: true, summary: "How your decks get onto the shelf and how picking works." },
  { id: "adding", label: "Adding your decks", Icon: Link2, parent: "core", summary: "Which Archidekt decks import, and how folders work." },
  { id: "showing", label: "Showing and hiding", Icon: Eye, parent: "core", summary: "Pills, Only this, Hide and Remove." },
  { id: "updates", label: "Refreshing decks", Icon: RefreshCw, parent: "core", summary: "What refresh changes, and what it keeps." },
  { id: "picking", label: "Finding and picking", Icon: Dices, parent: "core", summary: "Colors, search, shortlists and fair odds." },
  { id: "saving", label: "Saving and devices", Icon: HardDrive, parent: "core", summary: "Where your shelf lives and how to move it." },
  { id: "faq", label: "FAQ", Icon: MessageCircleQuestion, summary: "Missing decks, old versions and other surprises." },
  { id: "project", label: "Project", Icon: Folder, group: true, summary: "What DeckShelf does today and what’s planned." },
  { id: "features", label: "Features", Icon: Puzzle, parent: "project", summary: "Everything DeckShelf does, with a shortcut to each." },
  { id: "roadmap", label: "Roadmap", Icon: MapIcon, parent: "project", summary: "What’s next, later, and still being explored." },
  { id: "about", label: "About", Icon: Info, parent: "project", summary: "Why DeckShelf exists, and credits." },
] as const satisfies readonly { id: string; label: string; Icon: Icon; summary: string; group?: boolean; parent?: string }[];
export type HelpSection = (typeof helpSections)[number]["id"];
export type FeatureTarget = "grid" | "cards" | "picker" | "search" | "shortlist" | "collection" | "precons";
type Entry = (typeof helpSections)[number];
const parentOf = (entry: Entry) => "parent" in entry ? entry.parent : undefined;
const childrenOf = (id: HelpSection) => helpSections.filter(s => parentOf(s) === id);
const FOLDS_KEY = "deckshelf.help-folds";
// The public repository keeps this name when it is published (#36).
const REPO_URL = "https://github.com/Bircck/DeckShelf";
const external = (href: string, text: string) => <a href={href} target="_blank" rel="noreferrer">{text} <ExternalLink size={12} /></a>;

/** `/help` opens Start here; unknown sections fall back to it rather than leaving Help. */
export function helpSectionFromPath(path: string): HelpSection | null {
  const match = /^\/help(?:\/([\w-]+))?\/?$/.exec(path);
  if (!match) return null;
  return helpSections.find(s => s.id === match[1])?.id ?? "start";
}

// Topics explain rules the interface can't show. Each numbered rule matches a callout in its figure.
type Topic = { lead: ReactNode; Figure: ComponentType; rules: { title: string; text: ReactNode }[]; action?: { label: string; target: FeatureTarget } };
const topics: Partial<Record<HelpSection, Topic>> = {
  adding: {
    lead: <>Paste an Archidekt link in <b>My collection → Add decks</b>. DeckShelf only reads it: no login, and nothing changes on Archidekt.</>,
    Figure: AddingFigure,
    rules: [
      { title: "Paste any Archidekt link", text: "A username, profile, folder or single deck. You see the folders and decks before anything is added." },
      { title: "Only public Commander decks come in", text: "Private decks, other formats and decks without an assigned commander are skipped without a message." },
      { title: "Subfolders are separate", text: "Ticking a folder doesn’t include the folders inside it. Each has its own row; tick every one you want." },
      { title: "Show only these folders", text: "Switches your other collections off once every deck has loaded. They stay saved, and Enable all brings them back." },
    ],
    action: { label: "Add decks in My collection", target: "collection" },
  },
  showing: {
    lead: <>Four ways to change what’s on the shelf, from a quick switch to removing a source. None of them touches Archidekt.</>,
    Figure: ShowingFigure,
    rules: [
      { title: "Pill: on, off or some", text: "A quick switch for tonight. On a folder it remembers which subfolders were on; Ctrl-click (Cmd-click) turns them all on, or all off. Enable all turns every pill back on." },
      { title: "Only this", text: "Shows one collection and switches the others off. Enable all undoes it." },
      { title: "Hide", text: "In ⋯ More, for something you don’t want to look at. It moves to the Hidden list at the bottom of the sidebar, and Enable all skips it. Show brings it back with its deck choices." },
      { title: "Remove", text: "In ⋯ More, imported sources only. Deletes the source and the saved decks only it had. There is no undo; adding the source again brings its decks back." },
    ],
  },
  updates: {
    lead: <>Your shelf holds saved copies of your decks. They only change when you refresh, and a failed refresh keeps the copy you had.</>,
    Figure: UpdatesFigure,
    rules: [
      { title: "Refresh a source", text: "Updates the decks you’ve added from it and checks Archidekt for changes." },
      { title: "New decks wait", text: <>Decks added on Archidekt since your import show as <b>Not added</b> until you add them.</> },
      { title: "Deleted decks stay", text: <>A deck removed from Archidekt is marked <b>No longer listed · saved copy kept</b>.</> },
      { title: "Refresh one deck", text: <>Open the deck and press <b>Refresh snapshot</b> after editing it on Archidekt. Otherwise DeckShelf may reuse a copy from the last hour.</> },
    ],
  },
  picking: {
    lead: <>The picker draws from what the shelf shows: collections that are on, narrowed by search and colors, then by your shortlist if you made one.</>,
    Figure: PickingFigure,
    rules: [
      { title: "Collections that are on", text: "Hidden and switched-off collections are left out. A deck in two collections counts once." },
      { title: "Colors include; Exact matches", text: <>U and B shows every deck with both, Esper and Grixis too. Turn on <b>Exact colors</b> for Dimir only. Search needs every word to match.</> },
      { title: "Choose a few", text: <>Press <b>Choose a few</b>, click decks (Shift-click selects a range), then <b>Picker</b>. The numbers are just order. The shortlist lasts until you clear it or reload.</> },
      { title: "Equal odds", text: "Every deck in the pool has the same chance. Picking for 2–4 players gives each player a different deck, numbered in the order the spiral stops on them. Small pools repeat around the spiral; repeats don’t change the odds." },
    ],
    action: { label: "Open the picker", target: "picker" },
  },
  saving: {
    lead: <>There’s no account. Your shelf is saved in this browser, for this site address. Installing DeckShelf or using it offline does not make a backup or sync your choices.</>,
    Figure: SavingFigure,
    rules: [
      { title: "Each place keeps its own shelf", text: "Another browser, your phone, the Windows app and a local copy each start separately. On iPhone and iPad, the installed web app also keeps a separate shelf from Safari." },
      { title: "What a backup keeps", text: <>Export and restore are at the bottom of My collection. The version-1 file holds saved deck snapshots, precons, sources and collection choices, including hidden collections. Display preferences and temporary shortlists stay out. Keep a copy outside browser storage before clearing site data or moving devices.</> },
      { title: "Restore replaces, not merges", text: "A valid version-1 file is previewed before confirmation. It replaces your decks, sources and collection choices only after saving succeeds. A failed save keeps your current shelf and the preview for retry. Display preferences stay as they are." },
    ],
    action: { label: "Open My collection", target: "collection" },
  },
};

const faq: { group: string; items: { q: string; a: ReactNode; see?: HelpSection }[] }[] = [
  { group: "Getting started", items: [
    { q: "Why are there decks I don’t own?", a: "New shelves start with Official Commander precons so there’s something to browse. Add your own decks, then hide the precons (⋯ More → Hide) or use Only this on your collection.", see: "showing" },
    { q: "Does DeckShelf change my decks on Archidekt?", a: "No. It only reads public decks and never asks for a login. Edit decklists on Archidekt." },
  ] },
  { group: "Decks and collections", items: [
    { q: "Why is one of my decks missing?", a: "It may be private, not in the Commander format, or without an assigned commander. It may sit in a subfolder you didn’t tick, in a collection that’s off or hidden, or outside your current search and colors.", see: "adding" },
    { q: "A deck shows an old version", a: "Open it and press Refresh snapshot, or refresh its source in My collection.", see: "updates" },
    { q: "I switched a collection off but its decks still show", a: "They’re also in another collection that’s on. A deck shows while any collection holding it is on." },
  ] },
  { group: "Picking", items: [
    { q: "Is the random pick fair?", a: "Yes. Every deck in the pool has the same chance; the spiral’s repeats are only visual.", see: "picking" },
    { q: "Why can’t I press Picker?", a: "Select at least one deck that’s visible with your current search and colors. Selected decks hidden by a filter can’t be picked." },
  ] },
  { group: "Devices and more", items: [
    { q: "What if my collection cannot be saved or read?", a: "After a failed save, changes still work for this session: export them before closing, or retry saving when storage is available. Damaged or unreadable saved data is kept untouched until you confirm a valid restore. Download recovery data preserves the damaged file for manual repair; Export backup saves the current session instead.", see: "saving" },
    { q: "Can I use it on my phone and my computer?", a: "Yes, but each keeps its own shelf. Export a backup on one and restore it on the other. Sync between devices is on the roadmap.", see: "saving" },
    { q: "Does it work offline?", a: "Browsing and picking work once DeckShelf has loaded. Adding or refreshing decks needs a connection, and artwork may too unless your browser has cached it." },
    { q: "Moxfield, or formats other than Commander?", a: "Not yet. Archidekt and Commander only for now; both are on the roadmap.", see: "roadmap" },
    { q: "Where do I report a problem or suggest something?", a: <>Open an issue on {external(`${REPO_URL}/issues`, "GitHub")}. Include what you clicked and what you expected.</> },
  ] },
];

type Feature = { target: FeatureTarget | "saving"; title: string; caption: string; action: string; art: number; Icon: Icon };
const featureGroups: { label: string; items: Feature[] }[] = [
  { label: "Browse", items: [
    { target: "grid", title: "Collection", caption: "A wall of commander cards: details, cards only or a list.", action: "Open Collection", art: 0, Icon: LayoutGrid },
    { target: "cards", title: "Cards", caption: "Full commander cards in a carousel. Drag or use the arrow keys.", action: "Open Cards", art: 1, Icon: CardFanIcon },
    { target: "search", title: "Search and filters", caption: "Name, commander, colors, set or theme, in every view.", action: "Try search", art: 2, Icon: Search },
  ] },
  { label: "Pick", items: [
    { target: "picker", title: "Pick a deck", caption: "Spin the picker. Every deck in the pool has the same chance.", action: "Open the picker", art: 3, Icon: Dices },
    { target: "shortlist", title: "Choose a few", caption: "Shortlist the decks you’re torn between, then pick from those.", action: "Choose a few", art: 4, Icon: ListChecks },
  ] },
  { label: "Your shelf", items: [
    { target: "collection", title: "Your Archidekt decks", caption: "Paste a username, folder or deck link. Read-only, no login.", action: "Open My collection", art: 10, Icon: Link2 },
    { target: "precons", title: "Official precons", caption: "Commander precons to start with. Hide them any time.", action: "View precons", art: 11, Icon: Library },
    { target: "saving", title: "Saved in this browser", caption: "No account. Export a backup to move your shelf.", action: "Read Saving and devices", art: 6, Icon: HardDriveDownload },
  ] },
];

const tasks: { label: string; to: HelpSection }[] = [
  { label: "Add my Archidekt decks", to: "adding" },
  { label: "Show only my own decks", to: "showing" },
  { label: "Pick between a few decks", to: "picking" },
  { label: "Move my shelf to another device", to: "saving" },
];

const previews: Partial<Record<HelpSection, ComponentType>> = {
  ...Object.fromEntries(Object.entries(topics).map(([id, t]) => [id, t!.Figure])),
  features: FeaturesPreview, roadmap: RoadmapPreview, about: AboutPreview,
};

export default function HelpCenter({ section, onSection, onClose, onGo, precons }: {
  section: HelpSection;
  onSection: (section: HelpSection) => void;
  onClose: () => void;
  onGo: (target: FeatureTarget) => void;
  precons: { present: boolean; open: () => void };
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [folded, setFolded] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(FOLDS_KEY) || "[]"); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(FOLDS_KEY, JSON.stringify(folded)); } catch { /* Folding still works without storage. */ } }, [folded]);
  const entry = helpSections.find(s => s.id === section)!;
  const parent = helpSections.find(s => s.id === parentOf(entry));
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    // Opening a topic unfolds its group so the current page is always visible.
    if (parent) setFolded(current => current.filter(id => id !== parent.id));
  }, [section, parent]);
  const link = (id: HelpSection) => (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setMobileNav(false);
    onSection(id);
  };
  const go = (id: HelpSection, children: ReactNode, className?: string) => <a className={className} href={`/help/${id}`} onClick={link(id)}>{children}</a>;
  const item = (s: Entry) => <a href={`/help/${s.id}`} aria-current={s.id === section ? "page" : undefined} onClick={link(s.id)}>
    <s.Icon size={15} /><span>{s.label}</span>
  </a>;
  const topic = topics[section];
  return <main className="collection-workspace help-workspace" aria-label="Help">
    <header className="workspace-heading">
      <div><h1>Help</h1></div>
      {/* Phones fold the section tree behind one menu button in the heading row, like a docs site. */}
      <button className="help-mobile-toggle" aria-label="Help sections" title="Help sections" aria-expanded={mobileNav} aria-controls="help-nav" onClick={() => setMobileNav(v => !v)}>
        {mobileNav ? <X size={18} /> : <Menu size={18} />}
      </button>
      <button className="text-button workspace-back" aria-label="Back to collection" title="Back to collection" onClick={onClose}><ArrowLeft size={15} /><span>Back to collection</span></button>
    </header>
    <div className="help-body">
      <nav id="help-nav" className={mobileNav ? "help-nav is-open" : "help-nav"} aria-label="Help sections">
        <ul>
          {helpSections.filter(s => !parentOf(s)).map(s => {
            if (!("group" in s)) return <li key={s.id}>{item(s)}</li>;
            const open = !folded.includes(s.id);
            const GroupIcon = open ? FolderOpen : Folder;
            return <li key={s.id} className="help-group">
              <div className="help-group-row">
                <button className="help-fold" aria-expanded={open} aria-controls={`help-group-${s.id}`} aria-label={`${open ? "Collapse" : "Expand"} ${s.label}`}
                  onClick={() => setFolded(current => open ? [...current, s.id] : current.filter(id => id !== s.id))}>
                  <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : undefined }} />
                </button>
                <a href={`/help/${s.id}`} aria-current={s.id === section ? "page" : undefined} onClick={link(s.id)}><GroupIcon size={15} /><span>{s.label}</span></a>
              </div>
              {open && <ul id={`help-group-${s.id}`}>{childrenOf(s.id).map(c => <li key={c.id}>{item(c)}</li>)}</ul>}
            </li>;
          })}
        </ul>
      </nav>
      <section className={`help-content help-${section}`} aria-labelledby="help-section-title">
        {parent && go(parent.id, <><ArrowLeft size={13} />{parent.label}</>, "help-crumb")}
        <h2 id="help-section-title" ref={heading} tabIndex={-1}><span className="help-title-icon">{"group" in entry ? <FolderOpen size={20} /> : <entry.Icon size={20} />}</span>{entry.label}</h2>

        {"group" in entry && <ul className="help-tiles">
          {childrenOf(section).map(c => { const Preview = previews[c.id]; return <li key={c.id}>
            {go(c.id, <>
              <span className="help-tile-art" aria-hidden="true">{Preview && <span className="help-tile-scale"><Preview /></span>}</span>
              <span className="help-tile-text"><strong>{c.label}</strong><span>{c.summary}</span></span>
            </>)}
          </li>; })}
        </ul>}

        {topic && <div className="help-topic">
          <p className="help-lead">{topic.lead}</p>
          <div className="help-topic-figure"><topic.Figure /></div>
          <div className="help-topic-body">
            <ol className="help-rules">
              {topic.rules.map((r, i) => <li key={r.title}><span className="hf-n" aria-hidden="true">{i + 1}</span><span><strong>{r.title}</strong><span>{r.text}</span></span></li>)}
            </ol>
            {topic.action && <button className="button button-outline help-action" onClick={() => onGo(topic.action!.target)}>{topic.action.label} <ArrowRight size={15} /></button>}
          </div>
        </div>}

        {section === "start" && <div className="help-start-layout">
          <CollectionGuide present={precons.present} onPrecons={precons.open} />
          <div className="help-tasks">
            <h3>Common tasks</h3>
            <ul>{tasks.map(t => <li key={t.label}>{go(t.to, <><span>{t.label}</span><ArrowRight size={14} /></>)}</li>)}</ul>
          </div>
        </div>}

        {section === "faq" && <div className="help-faq-list">
          {faq.map(g => <section key={g.group} aria-labelledby={`faq-${g.group}`}>
            <h3 id={`faq-${g.group}`}>{g.group}</h3>
            {g.items.map(({ q, a, see }) => <details key={q}><summary>{q}</summary><p>{a}{see && <> {go(see, <>{helpSections.find(s => s.id === see)!.label} <ArrowRight size={12} /></>, "help-see")}</>}</p></details>)}
          </section>)}
        </div>}

        {section === "features" && <div className="feature-groups">
          {featureGroups.map(g => <section key={g.label} aria-labelledby={`features-${g.label}`}>
            <h3 id={`features-${g.label}`}>{g.label}</h3>
            <ul>{g.items.map(({ target, title, caption, action, art, Icon }) => <li key={title}>
              <button className="feature-row" title={action} onClick={() => target === "saving" ? onSection("saving") : onGo(target)}>
                <span className="feature-thumb"><img src={decks[art].commanders[0].art} alt="" /><span><Icon size={13} /></span></span>
                <span className="feature-text"><strong>{title}</strong><span>{caption}</span></span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </li>)}</ul>
          </section>)}
        </div>}

        {section === "roadmap" && <div className="roadmap">
          <div className="roadmap-stages">
            {roadmapStages.map(stage => <section key={stage.id} className={`roadmap-stage roadmap-${stage.id}`} aria-labelledby={`roadmap-${stage.id}`}>
              <h3 id={`roadmap-${stage.id}`}><span className="roadmap-dot" aria-hidden="true" />{stage.label}</h3>
              <ul>{roadmap.filter(item => item.stage === stage.id).map(item => <li key={item.issue}><strong>{item.title}</strong><span>{item.summary}</span></li>)}</ul>
            </section>)}
          </div>
          <p className="help-note">Plans, not promises. The order can change as DeckShelf gets used. Follow progress or suggest something on {external(`${REPO_URL}/issues`, "GitHub")}.</p>
        </div>}

        {section === "about" && <div className="help-topic">
          <div className="about-copy help-lead">
            <p className="about-lead">Your decks, ready for game night.</p>
            <ul className="about-points">
              <li><strong>Showcase your collection.</strong> Browse the artwork or pick a deck at random.</li>
              <li><strong>Make it yours.</strong> Mix public Archidekt decks with official precons. Choose what’s shown.</li>
              <li><strong>No account needed.</strong> Choices are saved in this browser. Export a backup to keep a copy.</li>
              <li><strong>Run it locally, too.</strong> Source imports and new artwork need internet. Edit decklists on Archidekt.</li>
            </ul>
          </div>
          <div className="help-topic-figure"><div className="hf hf-about-figure"><AboutPreview /></div></div>
          <div className="help-topic-body about-credits">
            <div className="about-links">
              {external(REPO_URL, "Source code on GitHub")}
              {external(`${REPO_URL}/issues`, "Report a problem or suggest a feature")}
              {external("https://archidekt.com/commander-precons", "Deck information: Archidekt")}
            </div>
            <span>
              DeckShelf is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards.
              Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
            </span>
          </div>
        </div>}
      </section>
    </div>
  </main>;
}
