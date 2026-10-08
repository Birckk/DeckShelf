import { renderToStaticMarkup } from "react-dom/server";
import { CollectionLayoutSwitch } from "../../src/CollectionLayoutSwitch";
import { Mana } from "../../src/components";
import type { Color } from "../../src/domain";
export const layoutControls = (layout: "grid" | "art" | "compact" | "list") =>
  renderToStaticMarkup(<CollectionLayoutSwitch value={layout} compact />);
export const mana = (colors: Color[]) => renderToStaticMarkup(<Mana colors={colors} />);
