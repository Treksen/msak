import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "msak-install-dismissed";

/** "Add MSAK to your home screen" — shows on phones that support installing PWAs. */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) setIosHint(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!event && !iosHint)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-navy-700 bg-navy-900 p-4 text-sm text-navy-100">
      <Smartphone className="size-6 flex-none text-gold-300" aria-hidden="true" />
      <p className="flex-1 leading-snug">
        {event ? "Add MSAK to your home screen — it opens like an app and works on weak signal." : "To install: tap Share, then “Add to Home Screen”."}
      </p>
      {event && (
        <button
          type="button"
          className="btn btn-gold btn-sm"
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
            dismiss();
          }}
        >
          Install
        </button>
      )}
      <button type="button" className="btn btn-sm text-navy-300 hover:text-white" aria-label="Dismiss" onClick={dismiss}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
