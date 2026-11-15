import { helpSections, type HelpSection } from "./helpSections.ts";

// The home title search results and browser tabs show; index.html carries the same text.
export const SITE_TITLE = "DeckShelf · Magic: The Gathering decks on one shelf";

export type PageMeta = { title: string; path: string | null };

/** The title and canonical address of what is on screen. Shared collections and Settings
 *  have no canonical address: they aren't pages for search results (the server marks shared
 *  links noindex). */
export function pageMeta(help: HelpSection | null, shared: { name?: string } | null): PageMeta {
  if (help === "settings") return { title: "Settings · DeckShelf", path: null };
  if (help) return { title: `${helpSections.find(s => s.id === help)!.label} · DeckShelf Help`, path: `/help/${help}` };
  if (shared) return { title: `${shared.name || "Shared collection"} · DeckShelf`, path: null };
  return { title: SITE_TITLE, path: "/" };
}

/** Addresses listed in public/sitemap.xml, in order. */
export const indexedPaths = () => ["/", ...helpSections.filter(s => s.id !== "settings").map(s => `/help/${s.id}`)];

export function applyPageMeta({ title, path }: PageMeta, doc: Document = document, loc: Location = location) {
  // The Windows app (archive://) keeps a short window title and has no public address.
  const web = loc.protocol === "https:" || loc.protocol === "http:";
  doc.title = !web && title === SITE_TITLE ? "DeckShelf" : title;
  let link = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!web || !path) { link?.remove(); return; }
  if (!link) {
    link = doc.createElement("link");
    link.rel = "canonical";
    doc.head.append(link);
  }
  link.href = loc.origin + path;
}
