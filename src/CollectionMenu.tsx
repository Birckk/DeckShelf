import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type MenuItem = { label: string; icon: ReactNode; run: () => void; confirm?: { text: string; action: string } };

// The less common collection actions, in one place and the same order everywhere.
// A destructive item asks once inside the menu before it runs.
export default function CollectionMenu({ name, busy, items }: { name: string; busy: boolean; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<MenuItem | null>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (focus = false) => { setOpen(false); setConfirming(null); if (focus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', key);
    // The popover is fixed to the viewport, so a scroll or resize would detach it.
    const dismiss = (event: Event) => { if (!popover.current?.contains(event.target as Node)) close(); };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    root.current?.querySelector<HTMLElement>('[role=menuitem], .collection-menu-confirm button')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', key); window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, [open, confirming]);
  // Scrolling box grids would clip an absolute popover; place it against the viewport instead.
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popover.current) return;
    const button = trigger.current.getBoundingClientRect();
    const height = popover.current.offsetHeight;
    const below = button.bottom + 4 + height <= window.innerHeight - 8;
    setPlace({ right: Math.max(8, window.innerWidth - button.right), ...(below ? { top: button.bottom + 4 } : { bottom: window.innerHeight - button.top + 4 }) });
  }, [open, confirming]);
  if (!items.length) return null;
  function arrows(event: React.KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const entries = [...root.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    entries[(index + (event.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length]?.focus();
  }
  return <div className="collection-menu" ref={root}>
    <button ref={trigger} className="text-button collection-menu-trigger" disabled={busy} aria-haspopup="menu" aria-expanded={open}
      aria-label={`More actions for ${name}`} title="More actions" onClick={() => open ? close() : setOpen(true)}><MoreHorizontal size={15} /></button>
    {open && (confirming
      ? <div ref={popover} style={place} className="collection-menu-popover collection-menu-confirm" role="dialog" aria-label={confirming.label}>
          <p>{confirming.confirm!.text}</p>
          <div>
            <button className="text-button" onClick={() => close(true)}>Cancel</button>
            <button className="text-button is-danger" onClick={() => { const item = confirming; close(true); item.run(); }}>{confirming.icon}{confirming.confirm!.action}</button>
          </div>
        </div>
      : <div ref={popover} style={place} className="collection-menu-popover" role="menu" aria-label={`Actions for ${name}`} onKeyDown={arrows}>
          {items.map(item => <button key={item.label} role="menuitem" onClick={() => item.confirm ? setConfirming(item) : (close(true), item.run())}>{item.icon}{item.label}</button>)}
        </div>)}
  </div>;
}
