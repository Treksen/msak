export type LatLng = { lat: number; lng: number };

/** Distance in kilometres between two points (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Ask the browser for the current position. */
export function getCurrentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This device can't share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was refused. Allow location for this site in your browser settings."
              : "We couldn't find your location. Try again outdoors or with GPS on.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

export const KENYA_CENTER: LatLng = { lat: 0.2, lng: 37.9 };
export const KENYA_BOUNDS: [[number, number], [number, number]] = [
  [-4.9, 33.8],
  [5.1, 42.0],
];
