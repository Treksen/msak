import { useEffect, useState } from "react";
import { api } from "./api";

/** Whether the public Past leaders page is switched on (checked once per visit). */
let cached: Promise<boolean> | null = null;
export function pastLeadersPublic(refresh = false): Promise<boolean> {
  if (!cached || refresh) cached = api.getPastLeadersPublic().catch(() => true);
  return cached;
}

export function usePastLeadersPublic(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void pastLeadersPublic().then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
