import { createContext, useContext } from "react";
import type { CardBackStyle, Color } from "../domain";
import { NestArt } from "./NestArt";
import { WedgesArt } from "./WedgesArt";

export const CardBackContext = createContext<CardBackStyle>("nest");

export function CardBackArt({ colors, style }: { colors: Color[]; style?: CardBackStyle }) {
  const selected = useContext(CardBackContext);
  return (style ?? selected) === "wedges" ? <WedgesArt colors={colors} /> : <NestArt colors={colors} />;
}
