import { api } from "../lib/api";

/** Reminder that the app is running on sample data (no Supabase keys). */
export function DemoBanner({ floating = false }: { floating?: boolean }) {
  if (api.mode !== "demo") return null;
  if (floating) {
    return (
      <p
        role="status"
        className="pointer-events-none fixed bottom-3 left-3 z-[900] max-w-[calc(100vw-24px)] rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-semibold text-navy-900 shadow-lg"
      >
        Demo mode · sample data in this browser only
      </p>
    );
  }
  return (
    <div className="bg-gold-500 px-4 py-1.5 text-center text-[13px] font-semibold text-navy-900">
      Demo mode — sample data saved in this browser only. Add your Supabase keys in <code>.env.local</code> to go live.
    </div>
  );
}
