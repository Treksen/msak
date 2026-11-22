import { useOutletContext } from "react-router";
import type { Lookup } from "./directory";
import type { permissions } from "./auth";

export type PortalContext = { lookup: Lookup; perms: ReturnType<typeof permissions> };

/** Directory lookups and the member's permissions, provided by PortalLayout. */
export function usePortal(): PortalContext {
  return useOutletContext<PortalContext>();
}
