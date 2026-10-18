import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster, toast, useSonner } from "sonner";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import "./notices.css";

// Results of actions, plus Undo where an action removes something (#57).
// Results fade; problems stay until dismissed.
export type NoticeTone = "done" | "problem";
export type NoticeAction = { label: string; run: () => void };
export type Notify = (message: string, options?: { tone?: NoticeTone; action?: NoticeAction }) => void;

const LIMIT = 3;
const GAP = 8;
const OFFSET = 24;
const results = new Set<string>();

export const notify: Notify = (message, { tone = "done", action } = {}) => {
  const options = { id: message, action: action && { label: action.label, onClick: action.run } };
  if (tone === "problem") {
    results.delete(message);
    toast.error(<span role="alert">{message}</span>, { ...options, duration: Infinity, icon: <AlertTriangle size={15} />, className: "notice notice-problem" });
    return;
  }
  results.add(message);
  toast(message, { ...options, duration: action ? 9000 : 5500, icon: action ? <Undo2 size={15} /> : <Check size={15} /> });
};

// Clear results (not problems), e.g. before a confirmation they could cover.
export function clearResults() {
  results.forEach(id => toast.dismiss(id));
  results.clear();
}

// A modal dialog sits in the top layer, above anything outside it, so notices
// move into the open dialog while there is one.
function useModalHost() {
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const update = () => setHost([...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter(d => d.matches(":modal")).pop() || null);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    update();
    return () => observer.disconnect();
  }, []);
  return host;
}

export function Notices() {
  const { toasts } = useSonner();
  const host = useModalHost();
  const count = Math.min(toasts.length, LIMIT);
  // Leave room below the page so its last controls (Export, Restore, Done on a
  // phone) can scroll clear of the collapsed stack.
  useEffect(() => {
    const root = document.documentElement;
    if (!count) { root.style.removeProperty("--notice-space"); return; }
    const front = () => document.querySelector<HTMLElement>("[data-sonner-toast][data-front='true']");
    const reserve = () => {
      const toast = front();
      if (toast) root.style.setProperty("--notice-space", `${OFFSET + toast.offsetHeight + GAP * count}px`);
    };
    const timer = setTimeout(() => { reserve(); const toast = front(); if (toast) observer.observe(toast); });
    const observer = new ResizeObserver(reserve);
    addEventListener("resize", reserve);
    return () => { clearTimeout(timer); observer.disconnect(); removeEventListener("resize", reserve); };
  }, [count, toasts]);
  useEffect(() => () => { document.documentElement.style.removeProperty("--notice-space"); }, []);
  const toaster = <Toaster theme="dark" position="bottom-center" visibleToasts={LIMIT} closeButton gap={GAP} offset={OFFSET} mobileOffset={16}
    toastOptions={{ className: "notice", classNames: { actionButton: "notice-action", closeButton: "notice-close" } }} />;
  return host ? createPortal(toaster, host) : toaster;
}
