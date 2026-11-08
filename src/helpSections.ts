import type { ComponentType } from "react";
import { BookOpen, Dices, Eye, Folder, HardDrive, Info, Link2, Map as MapIcon, MessageCircleQuestion, Puzzle, RefreshCw, Settings, Users } from "lucide-react";

// Help's sections and addresses live apart from Help itself, which loads on demand.
type Icon = ComponentType<{ size?: number }>;
// Groups are folders in the navigation with their own overview page; the rest are topics.
export const helpSections = [
  { id: "start", label: "Start here", Icon: BookOpen, summary: "A three-page visual tour." },
  { id: "core", label: "Core", Icon: Folder, group: true, summary: "How your decks get onto the shelf and how picking works." },
  { id: "adding", label: "Adding your decks", Icon: Link2, parent: "core", summary: "Which Archidekt decks import, and how folders work." },
  { id: "showing", label: "Showing and hiding", Icon: Eye, parent: "core", summary: "Pills, Only this, Hide and Remove." },
  { id: "updates", label: "Refreshing decks", Icon: RefreshCw, parent: "core", summary: "What refresh changes, and what it keeps." },
  { id: "picking", label: "Finding and picking", Icon: Dices, parent: "core", summary: "Colors, search, shortlists and fair odds." },
  { id: "friends", label: "Friends’ collections", Icon: Users, parent: "core", summary: "Opening, bookmarking and saving someone else’s shelf." },
  { id: "saving", label: "Saving and devices", Icon: HardDrive, parent: "core", summary: "Where your shelf lives and how to move it." },
  { id: "faq", label: "FAQ", Icon: MessageCircleQuestion, summary: "Missing decks, old versions and other surprises." },
  { id: "project", label: "Project", Icon: Folder, group: true, summary: "What DeckShelf does today and what’s planned." },
  { id: "features", label: "Features", Icon: Puzzle, parent: "project", summary: "Everything DeckShelf does, with a shortcut to each." },
  { id: "roadmap", label: "Roadmap", Icon: MapIcon, parent: "project", summary: "What’s next, later, and still being explored." },
  { id: "about", label: "About", Icon: Info, parent: "project", summary: "Why DeckShelf exists, and credits." },
  { id: "settings", label: "Settings", Icon: Settings, summary: "Card backs, artwork, List columns and new decks." },
] as const satisfies readonly { id: string; label: string; Icon: Icon; summary: string; group?: boolean; parent?: string }[];
export type HelpSection = (typeof helpSections)[number]["id"];
export type FeatureTarget = "grid" | "cards" | "picker" | "search" | "shortlist" | "collection" | "precons";

/** `/help` opens Start here; unknown sections fall back to it rather than leaving Help. `/settings` is Help's Settings section. */
export function helpSectionFromPath(path: string): HelpSection | null {
  if (/^\/settings\/?$/.test(path)) return "settings";
  const match = /^\/help(?:\/([\w-]+))?\/?$/.exec(path);
  if (!match) return null;
  return helpSections.find(s => s.id === match[1])?.id ?? "start";
}
