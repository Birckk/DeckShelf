import type { Color } from "../domain";

// Five art deco wedges (idea 5.1 in #62), one per colour of the wheel, meeting at the card's centre.
// A colour in the identity shows its traced surface from /card-backs and its symbol in a gold socket;
// a missing colour stays dark with an empty socket. Each surface is a separate, cached SVG file,
// so every identity is built from the same five files without repeating paths in the page.
const W = 100;
const H = 140;
const CX = W / 2;
const CY = H / 2;
const WHEEL: Color[] = ["W", "U", "B", "R", "G"];
const STEP = 360 / WHEEL.length;
const REACH = 130;
// Where the art painted each socket (after its wedges were fitted to the template).
const SOCKET_AT: Record<Color, [number, number]> = {
  W: [50.06, 52.85], U: [63.76, 65.45], B: [60.68, 84.33], R: [39.53, 84.16], G: [36, 65.67],
};
const SYMBOL_SIZE = 16.5;
// Shown while a surface loads, and if it can't.
const FILL: Record<Color, string> = { W: "#e6d3a4", U: "#24406b", B: "#3a3836", R: "#9c3d22", G: "#2f5a35" };
const BACKGROUND = "#1b1c20";
const OFF = "#202126";
const GOLD = "#c9a660";
const SOCKET = "#3a3b41";

function point(angle: number, radius: number) {
  const a = (angle * Math.PI) / 180;
  return [CX + radius * Math.sin(a), CY - radius * Math.cos(a)] as const;
}
function wedgePath(index: number) {
  const [x1, y1] = point(index * STEP - STEP / 2, REACH);
  const [x2, y2] = point(index * STEP + STEP / 2, REACH);
  return `M${CX} ${CY}L${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
}
const WEDGES = WHEEL.map((_, i) => wedgePath(i));

export function WedgesArt({ colors }: { colors: Color[] }) {
  return (
    <svg className="identity-art" data-card-back="wedges" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={W} height={H} fill={BACKGROUND} />
      {WHEEL.map((color, i) => colors.includes(color)
        ? <g key={color}>
          <path d={WEDGES[i]} fill={FILL[color]} />
          <image href={`/card-backs/wedges-${color}.svg`} width={W} height={H} preserveAspectRatio="none" />
        </g>
        : <path key={color} d={WEDGES[i]} fill={OFF} />)}
      {WHEEL.map((_, i) => {
        const [x, y] = point(i * STEP + STEP / 2, REACH);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={GOLD} strokeWidth={0.8} />;
      })}
      {WHEEL.map(color => {
        const on = colors.includes(color);
        const [x, y] = SOCKET_AT[color];
        return <g key={color} data-slot={color} data-on={on || undefined}>
          <circle cx={x} cy={y} r={SYMBOL_SIZE / 2 + 0.5} fill={on ? BACKGROUND : "#18191d"} stroke={on ? GOLD : SOCKET} strokeWidth={1} />
          {on && <image href={`/mana/${color}.svg`} x={x - SYMBOL_SIZE / 2} y={y - SYMBOL_SIZE / 2} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />}
        </g>;
      })}
      {colors.length === 0 && <g data-slot="C">
        <circle cx={CX} cy={CY} r={4.6} fill={BACKGROUND} stroke={GOLD} strokeWidth={0.6} />
        <image href="/mana/C.svg" x={CX - 3.9} y={CY - 3.9} width={7.8} height={7.8} />
      </g>}
    </svg>
  );
}
