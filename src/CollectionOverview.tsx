import {
  ArrowRight,
  ExternalLink,
  Folder,
  Library,
  Link2,
  UserRound,
} from "lucide-react";
import { Artwork } from "./components";
import { type Collection, type Deck } from "./domain";
import { type ShowcaseGroup } from "./collection";

export default function CollectionOverview({
  groups,
  collection,
  decks,
  busy,
  navigate,
  toggle,
  only,
  enableAll,
  browsePrecons,
}: {
  groups: ShowcaseGroup[];
  collection: Collection;
  decks: Deck[];
  busy: boolean;
  navigate: (key: string) => void;
  toggle: (key: string, enabled: boolean) => void;
  only: (key: string) => void;
  enableAll: () => void;
  browsePrecons: () => void;
}) {
  const saved = new Map(decks.map((d) => [d.id, d]));
  return (
    <div className="collection-overview">
      <div className="overview-intro">
        <div>
          <h3>What’s on display?</h3>
          <p>
            Enable the collections you want to browse and pick from. Turning one
            off keeps your deck selections.
          </p>
        </div>
        <button className="text-button" disabled={busy} onClick={enableAll}>
          Enable all
        </button>
      </div>
      <div className="overview-groups">
        {[
          ...groups.filter((g) => g.kind === "folder" || g.kind === "account"),
          ...groups.filter((g) => g.kind === "included" || g.kind === "manual"),
        ].map((group) => {
          const count = group.ids.filter(
            (id) => !collection.hidden.includes(id),
          ).length;
          const preview = group.ids
            .map((id) => saved.get(id))
            .filter((d): d is Deck => !!d)
            .slice(0, 3);
          const Icon =
            group.kind === "folder"
              ? Folder
              : group.kind === "account"
                ? UserRound
                : group.kind === "manual"
                  ? Link2
                  : Library;
          return (
            <article
              className={`overview-group ${group.enabled ? "" : "is-paused"}`}
              key={group.key}
            >
              <div className="overview-group-top">
                <Icon size={18} />
                <button
                  className="overview-group-title"
                  disabled={busy}
                  onClick={() => navigate(group.key)}
                >
                  {group.name}
                </button>
                <label className="overview-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Enable ${group.name}`}
                    checked={group.enabled}
                    disabled={busy}
                    onChange={(e) => toggle(group.key, e.target.checked)}
                  />
                  <span>{group.enabled ? "On" : "Off"}</span>
                </label>
              </div>
              <div className="overview-group-info">
                <div className="overview-previews" aria-hidden="true">
                  {preview.map((d) => (
                    <Artwork key={d.id} src={d.commanders[0].art} alt="" />
                  ))}
                  {!preview.length && <Icon size={25} />}
                </div>
                <div>
                  <p>
                    {group.kind === "included"
                      ? "The original 29 decks supplied with this app, with offline artwork."
                      : group.kind === "manual"
                        ? "Decks added individually, or kept after disconnecting a source."
                        : group.key === "account:archidekt_precons"
                          ? "Your selections from Archidekt’s curated precon catalog."
                          : `Public Archidekt ${group.kind}${group.kind === "folder" ? " · direct decks only" : ""}.`}
                  </p>
                  <small>
                    {count} selected
                    {group.kind === "account" || group.kind === "folder"
                      ? ` · ${group.available} found at source`
                      : ` of ${group.ids.length} saved`}
                    {!group.enabled ? " · collection off" : ""}
                  </small>
                </div>
              </div>
              <div className="overview-group-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => only(group.key)}
                >
                  Only this
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => navigate(group.key)}
                >
                  Choose decks <ArrowRight size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="overview-catalog">
        <Library size={20} />
        <div>
          <h4>Looking for another precon?</h4>
          <p>
            Browse Archidekt’s larger catalog and add the decks you own. Nothing
            is selected automatically.
          </p>
          <a
            href="https://archidekt.com/commander-precons"
            target="_blank"
            rel="noreferrer"
          >
            View catalog on Archidekt <ExternalLink size={12} />
          </a>
        </div>
        <button
          className="button button-outline"
          disabled={busy}
          onClick={browsePrecons}
        >
          Browse precons <ArrowRight size={14} />
        </button>
      </div>
      <p className="overview-note">
        A deck in several collections appears once, as long as one of those
        collections is enabled. Individual deck selections and picker exclusions
        still apply.
      </p>
    </div>
  );
}
