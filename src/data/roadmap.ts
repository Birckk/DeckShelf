// User-facing summary of open GitHub issues. The issues stay authoritative;
// update this list when their priority labels change or they ship.
export type RoadmapStage = "next" | "later" | "exploring";

export const roadmapStages: { id: RoadmapStage; label: string }[] = [
  { id: "next", label: "Next" },
  { id: "later", label: "Later" },
  { id: "exploring", label: "Exploring" },
];

export const roadmap: { stage: RoadmapStage; issue: number; title: string; summary: string }[] = [
  { stage: "next", issue: 2, title: "Your decks in fewer steps", summary: "Paste a link and see your own decks straight away." },
  { stage: "next", issue: 23, title: "Followed folders stay fresh", summary: "New decks in a followed Archidekt folder appear without losing your choices." },
  { stage: "next", issue: 24, title: "Share your shelf with a link", summary: "Send a link that opens your public collection directly." },
  { stage: "later", issue: 4, title: "Install and browse offline", summary: "Add DeckShelf to your home screen and open it without a connection." },
  { stage: "later", issue: 5, title: "Clearer saving and backups", summary: "Easier to find, and clearer about what stays in this browser." },
  { stage: "later", issue: 22, title: "Formats beyond Commander", summary: "Modern, Pauper and other decks, each under its own format." },
  { stage: "exploring", issue: 78, title: "Picker settings", summary: "Choose how picked decks are laid out and how the pick plays out." },
  { stage: "exploring", issue: 6, title: "Sync between devices", summary: "The same shelf and choices on your phone and computer." },
];
