import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { Globe, Map as MapIcon } from "lucide-react";
import type { Church } from "../lib/types";
import { KENYA_BOUNDS, type LatLng } from "../lib/geo";

/* ---------------------------------------------------------------------------
   Base maps
   - Map (default): OpenStreetMap street map.
   - Satellite: Esri World Imagery + Esri place/road labels on top.
   Both can be swapped through .env (see .env.example), e.g. for MapTiler.
--------------------------------------------------------------------------- */
const env = import.meta.env as Record<string, string | undefined>;

const STREET = {
  url: env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const SATELLITE = {
  url: env.VITE_SATELLITE_TILE_URL || `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
  attribution:
    env.VITE_SATELLITE_ATTRIBUTION ||
    'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
  labels: env.VITE_SATELLITE_TILE_URL
    ? (env.VITE_SATELLITE_LABELS_URL ? [env.VITE_SATELLITE_LABELS_URL] : [])
    : [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
};

export type BaseLayer = "satellite" | "street";
const LAYER_KEY = "msak-map-layer-v2";

/** Remembers the member's choice; street map by default. */
function useBaseLayer(): [BaseLayer, (l: BaseLayer) => void] {
  const [layer, setLayer] = useState<BaseLayer>(() => {
    try {
      return localStorage.getItem(LAYER_KEY) === "satellite" ? "satellite" : "street";
    } catch {
      return "street";
    }
  });
  const set = (l: BaseLayer) => {
    setLayer(l);
    try {
      localStorage.setItem(LAYER_KEY, l);
    } catch {
      /* ignore */
    }
  };
  return [layer, set];
}

function EsriSatellite() {
  return (
    <>
      <TileLayer key="sat" url={SATELLITE.url} attribution={SATELLITE.attribution} maxNativeZoom={19} maxZoom={20} />
      {SATELLITE.labels.map((u) => (
        <TileLayer key={u} url={u} maxNativeZoom={18} maxZoom={20} attribution="Labels &copy; Esri" />
      ))}
    </>
  );
}

function BaseTiles({ layer }: { layer: BaseLayer }) {
  if (layer === "street") {
    return <TileLayer key="street" url={STREET.url} attribution={STREET.attribution} maxZoom={19} />;
  }
  return <EsriSatellite />;
}

/** Satellite / Map switch drawn over the map. */
function LayerSwitch({ layer, onChange }: { layer: BaseLayer; onChange: (l: BaseLayer) => void }) {
  const item = (id: BaseLayer, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={layer === id}
      className={`flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold sm:px-3 ${
        layer === id ? "bg-navy-900 text-white" : "text-navy-900 hover:bg-gold-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Map style" className="absolute right-2.5 top-2.5 z-[600] flex gap-0.5 rounded-lg bg-white p-[3px] shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
      {item("satellite", "Satellite", <Globe className="size-4" aria-hidden="true" />)}
      {item("street", "Map", <MapIcon className="size-4" aria-hidden="true" />)}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function pinIcon(kind: "default" | "selected" | "suggested") {
  const fill = kind === "selected" ? "#C9A04A" : kind === "suggested" ? "#8A93A6" : "#0B1F4D";
  const size = kind === "selected" ? 44 : 34;
  return L.divIcon({
    className: "msak-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 23s-8-7-8-13a8 8 0 0 1 16 0c0 6-8 13-8 13z" fill="${fill}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`,
  });
}
const icons = { default: pinIcon("default"), selected: pinIcon("selected"), suggested: pinIcon("suggested") };
const clusterIcons = new Map<number, L.DivIcon>();
function clusterIcon(n: number) {
  let icon = clusterIcons.get(n);
  if (!icon) {
    const size = n < 10 ? 40 : n < 50 ? 46 : 54;
    icon = L.divIcon({ className: "msak-cluster", html: `<span>${n}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    clusterIcons.set(n, icon);
  }
  return icon;
}

/**
 * Pins that are close together on screen merge into a numbered circle; tap it to zoom in.
 * From street level (zoom 15+) every church shows on its own. The selected church is never hidden in a group.
 */
function ClusteredMarkers({ churches, selectedId, onSelect }: { churches: Church[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const groups = useMemo(() => {
    if (zoom >= 15) return churches.map((c) => [c]);
    const cell = 64;
    const cells = new Map<string, Church[]>();
    for (const c of churches) {
      const pt = map.project([c.lat, c.lng], zoom);
      const key = `${Math.floor(pt.x / cell)}:${Math.floor(pt.y / cell)}`;
      const list = cells.get(key);
      if (list) list.push(c);
      else cells.set(key, [c]);
    }
    return [...cells.values()];
  }, [churches, zoom, map]);

  return (
    <>
      {groups.flatMap((g) => {
        if (g.length === 1 || g.some((c) => c.id === selectedId)) {
          return g.map((c) => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={c.id === selectedId ? icons.selected : c.status === "suggested" ? icons.suggested : icons.default}
              title={c.name}
              alt={c.name}
              keyboard
              zIndexOffset={c.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect?.(c.id) }}
            />
          ));
        }
        const lat = g.reduce((a, c) => a + c.lat, 0) / g.length;
        const lng = g.reduce((a, c) => a + c.lng, 0) / g.length;
        const bounds = L.latLngBounds(g.map((c) => [c.lat, c.lng] as [number, number]));
        return [
          <Marker
            key={`cluster-${g[0].id}-${g.length}`}
            position={[lat, lng]}
            icon={clusterIcon(g.length)}
            title={`${g.length} churches — zoom in`}
            alt={`${g.length} churches`}
            keyboard
            eventHandlers={{ click: () => map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 }) }}
          />,
        ];
      })}
    </>
  );
}

const meIcon = L.divIcon({ className: "", html: '<div class="msak-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

/** Re-fit the view whenever `fitKey` changes. */
function FitTo({ points, fitKey, focus }: { points: LatLng[]; fitKey: string; focus?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      return;
    }
    if (points.length === 0) {
      map.fitBounds(KENYA_BOUNDS);
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, focus?.lat, focus?.lng]);
  return null;
}

/** Leaflet measures its box once; re-measure after dialogs/panels open or the window resizes. */
function Remeasure() {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      // Leaving the page mid-animation (fly/zoom to the churches) would make Leaflet finish moving a map
      // that no longer exists ("_leaflet_pos" error). Stop it first.
      try {
        map.stop();
      } catch {
        /* already gone */
      }
    };
  }, [map]);
  return null;
}

/** Keep the picked pin in view without fighting the member's zoom. */
function KeepInView({ value }: { value: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([value.lat, value.lng])) map.panTo([value.lat, value.lng]);
    if (map.getZoom() < 15) map.setView([value.lat, value.lng], 17);
  }, [map, value.lat, value.lng]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

type Props = {
  churches: Church[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  me?: LatLng | null;
  fitKey: string;
  className?: string;
  /** Allow scroll-wheel zoom (off on the homepage so the page scrolls normally). */
  wheelZoom?: boolean;
};

/** The church map: street map by default, switchable to satellite. */
export function ChurchMap({ churches, selectedId, onSelect, me, fitKey, className, wheelZoom = true }: Props) {
  const [layer, setLayer] = useBaseLayer();
  const points = useMemo(() => churches.map((c) => ({ lat: c.lat, lng: c.lng })), [churches]);
  const selected = churches.find((c) => c.id === selectedId) ?? null;
  return (
    <div className={`relative ${className ?? "h-full w-full"}`}>
      <MapContainer
        bounds={KENYA_BOUNDS}
        scrollWheelZoom={wheelZoom}
        // On the homepage, phones scroll the page instead of panning the map (zoom buttons still work)
        dragging={wheelZoom || !L.Browser.mobile}
        className="h-full w-full"
        attributionControl
      >
        <BaseTiles layer={layer} />
        <Remeasure />
        <FitTo points={me ? [...points, me] : points} fitKey={fitKey} focus={selected} />
        <ClusteredMarkers churches={churches} selectedId={selectedId} onSelect={onSelect} />
        {me && <Marker position={[me.lat, me.lng]} icon={meIcon} title="You are here" alt="You are here" interactive={false} />}
      </MapContainer>
      <LayerSwitch layer={layer} onChange={setLayer} />
    </div>
  );
}

/** A small map for placing one pin: tap the map or drag the pin. Satellite helps spot the actual building. */
export function PinPicker({ value, onChange, className }: { value: LatLng | null; onChange: (p: LatLng) => void; className?: string }) {
  const [layer, setLayer] = useBaseLayer();
  return (
    <div className={`relative overflow-hidden rounded-md ${className ?? "h-72 w-full"}`}>
      <MapContainer
        bounds={value ? undefined : KENYA_BOUNDS}
        center={value ? [value.lat, value.lng] : undefined}
        zoom={value ? 17 : undefined}
        scrollWheelZoom
        className="h-full w-full"
      >
        <BaseTiles layer={layer} />
        <Remeasure />
        <ClickToPick onPick={onChange} />
        {value && <KeepInView value={value} />}
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={icons.selected}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as LeafletMarker).getLatLng();
                onChange({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
      <LayerSwitch layer={layer} onChange={setLayer} />
    </div>
  );
}
