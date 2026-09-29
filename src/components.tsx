import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ImageOff } from "lucide-react";
import { COLORS, type Color } from "./domain";

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
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div
      className={`art-fallback ${className}`}
      role="img"
      aria-label={`${alt} — image unavailable`}
    >
      <ImageOff size={28} />
      <span>{alt}</span>
    </div>
  ) : (
    <img
      className={className}
      src={src}
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
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">{title}</span>
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
