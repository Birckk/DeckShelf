import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, ImageOff } from "lucide-react";
import { cardImage, COLORS, type Color } from "./domain";
import { useOnline } from "./pwa";
import { NestArt } from "./placeholders/NestArt";

export function ManaSymbol({ color }: { color: Color | "C" }) {
  return (
    <img
      className={`mana mana-${color}`}
      src={`/mana/${color}.svg`}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
    />
  );
}
export function Mana({
  colors,
  size = "",
}: {
  colors: Color[];
  size?: string;
}) {
  return (
    <span
      className={`mana-row ${size}`}
      aria-label={
        colors.length
          ? colors.map((c) => COLORS.find((v) => v.id === c)?.name).join(", ")
          : "Colorless"
      }
    >
      {colors.length ? (
        colors.map((c) => <ManaSymbol key={c} color={c} />)
      ) : (
        <ManaSymbol color="C" />
      )}
    </span>
  );
}
export function Artwork({
  src,
  alt,
  className = "",
  eager = false,
  colors,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  /** Deck colour identity; drawn in place of the artwork when it can't load. */
  colors?: Color[];
}) {
  const [failed, setFailed] = useState(false);
  const online = useOnline();
  // Imported artwork comes from Archidekt; retry once the connection returns.
  useEffect(() => setFailed(false), [src, online]);
  return failed ? (
    <div
      className={`art-fallback ${colors ? "has-identity" : ""} ${className}`}
      role="img"
      aria-label={`${alt} — ${online ? "image unavailable" : "artwork unavailable offline"}`}
    >
      {colors ? <NestArt colors={colors} /> : <ImageOff size={28} />}
      <span>{alt}</span>
      {!online && <small>Offline</small>}
    </div>
  ) : (
    <img
      className={className}
      src={cardImage(src)}
      crossOrigin={cardImage(src) === src ? undefined : "anonymous"}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  headerActions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        if (e.target === e.currentTarget &&
          (e.clientX < bounds.left || e.clientX > bounds.right ||
           e.clientY < bounds.top || e.clientY > bounds.bottom)) onClose();
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title" id={titleId}>{title}</h2>
        {headerActions}
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
