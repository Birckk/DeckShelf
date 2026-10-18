import { useEffect, useState, useSyncExternalStore } from "react";

// Offline support for the hosted web app. The desktop app serves files itself and
// development builds skip the worker so changes appear on reload.
let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const announce = (worker: ServiceWorker | null) => {
  waiting = worker;
  listeners.forEach((listener) => listener());
};

export function registerServiceWorker() {
  // No install banner on opening (owner decision): the browser menu still offers Install / Add to Home screen.
  window.addEventListener("beforeinstallprompt", (event) => event.preventDefault());
  // Desktop browsers get no manifest, so they don't offer an install in the address bar; the Windows app
  // covers desktop. Touch devices and already-installed apps keep it.
  if (matchMedia("(pointer: coarse), (display-mode: standalone)").matches) {
    document.head.append(Object.assign(document.createElement("link"), { rel: "manifest", href: "/manifest.webmanifest" }));
  }
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("/sw.js").catch(() => null);
    if (!registration) return;
    // Installed apps ask the browser not to evict saved data. Browser tabs don't, as Firefox would prompt.
    if (matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true) navigator.storage?.persist?.().catch(() => {});
    // Only an update to an already-controlled page waits for the reader's Reload choice.
    const track = (worker: ServiceWorker | null) => {
      if (!worker || !navigator.serviceWorker.controller) return;
      if (worker.state === "installed") announce(worker);
      else worker.addEventListener("statechange", () => worker.state === "installed" && announce(worker));
    };
    track(registration.waiting || registration.installing);
    registration.addEventListener("updatefound", () => track(registration.installing));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {});
    });
  });
}

export function applyUpdate() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  waiting.postMessage("skip-waiting");
}

export function useUpdateReady() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => waiting !== null,
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
