# Working on DeckShelf

Read [docs/DESIGN.md](docs/DESIGN.md) before changing user-facing layout, styling, motion, icons, or copy. It records the owner's accepted direction and specific patterns they asked us to remove. Follow it unless the user's current request changes that direction.

- Take page gutters, shared widths and breakpoints from `src/layout.css`; do not add new media-query widths or fixed side padding on page containers (tests enforce both).
- Refine the existing interface; do not replace it with a generic generated dashboard or landing page.
- Keep the collection and deck viewer as the main content. Decklist management belongs at the source, currently Archidekt.
- Preserve local operation, saved collection choices, accessible controls, and reduced-motion support.
- For behavior changes, run relevant tests and `npm run build`. For visual changes, also inspect the affected views in the browser at desktop and mobile sizes. Documentation-only changes do not require a build.
- Describe verified results accurately; distinguish tested behavior from aesthetic judgment.
- See [docs/PROJECT.md](docs/PROJECT.md) for the backlog workflow. Track task status and acceptance criteria in GitHub issues; distinguish implemented, tested and deployed work. Current owner requests take priority over the recorded order.
