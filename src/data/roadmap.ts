// User-facing summary of open GitHub issues. The issues stay authoritative;
// update this list when their priority labels change or they ship.
// Everything planned for 1.0 has shipped, so Next and Later are empty. Exploring lists
// ideas from the parking-lot issues (#110, #111), which are open but not planned.
export type RoadmapStage = "next" | "later" | "exploring";

export const roadmapStages: { id: RoadmapStage; label: string }[] = [
  { id: "next", label: "Next" },
  { id: "later", label: "Later" },
  { id: "exploring", label: "Exploring" },
];

export const roadmap: { stage: RoadmapStage; issue: number; title: string; summary: string }[] = [
  { stage: "exploring", issue: 111, title: "Play from one shared folder", summary: "At a friend’s, pick only from one folder of their shelf, without saving anything." },
  { stage: "exploring", issue: 111, title: "Save just one shared folder", summary: "Keep a single folder from someone’s shelf instead of the whole account." },
  { stage: "exploring", issue: 111, title: "Refresh a kept shelf", summary: "Update a shelf you kept from Archidekt; new decks wait for you to choose them." },
  { stage: "exploring", issue: 110, title: "More kinds of picker", summary: "A wheel, a dice roll or a booster-pack opening beside the Helix and Shuffle." },
];
