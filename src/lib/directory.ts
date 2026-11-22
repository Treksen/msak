import type { Association, County, Directory, Institution } from "./types";

/** Fast lookups over the association → county → institution directory. */
export function makeLookup(d: Directory | null) {
  const assoc = new Map<number, Association>();
  const county = new Map<number, County>();
  const inst = new Map<number, Institution>();
  d?.associations.forEach((a) => assoc.set(a.id, a));
  d?.counties.forEach((c) => county.set(c.id, c));
  d?.institutions.forEach((i) => inst.set(i.id, i));

  return {
    associations: d?.associations ?? [],
    association: (id: number | null | undefined) => (id == null ? undefined : assoc.get(id)),
    county: (id: number | null | undefined) => (id == null ? undefined : county.get(id)),
    institution: (id: number | null | undefined) => (id == null ? undefined : inst.get(id)),
    countiesOf: (associationId: number | null | undefined) =>
      (d?.counties ?? []).filter((c) => c.association_id === associationId).sort((a, b) => a.name.localeCompare(b.name)),
    institutionsOf: (countyId: number | null | undefined) =>
      (d?.institutions ?? []).filter((i) => i.county_id === countyId).sort((a, b) => a.name.localeCompare(b.name)),
    institutionsInAssociation: (associationId: number | null | undefined) => {
      const ids = new Set((d?.counties ?? []).filter((c) => c.association_id === associationId).map((c) => c.id));
      return (d?.institutions ?? []).filter((i) => ids.has(i.county_id)).sort((a, b) => a.name.localeCompare(b.name));
    },
    associationOfInstitution(institutionId: number | null | undefined): Association | undefined {
      const i = institutionId == null ? undefined : inst.get(institutionId);
      const c = i && county.get(i.county_id);
      return c ? assoc.get(c.association_id) : undefined;
    },
    countyOfInstitution(institutionId: number | null | undefined): County | undefined {
      const i = institutionId == null ? undefined : inst.get(institutionId);
      return i ? county.get(i.county_id) : undefined;
    },
    /** "Kenyatta University · Kiambu · NAMSA" */
    placeLabel(institutionId: number | null | undefined): string {
      const i = institutionId == null ? undefined : inst.get(institutionId);
      if (!i) return "";
      const c = county.get(i.county_id);
      const a = c && assoc.get(c.association_id);
      return [i.name, c?.name, a?.code].filter(Boolean).join(" · ");
    },
  };
}

export type Lookup = ReturnType<typeof makeLookup>;

/** Short name for long institution names: "Jomo Kenyatta University of … (JKUAT)" → "JKUAT". */
export function shortInstitution(name: string | undefined): string {
  if (!name) return "";
  const m = name.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1];
  return name.length > 34 ? `${name.slice(0, 32)}…` : name;
}
