export const SHOP = {
  lat: 28.646457,
  lng: 77.158939,
  name: "3026/5A, Ranjeet Nagar, South Patel Nagar, New Delhi - 110008",
};
export const FREE_KM = 3;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type DeliveryType = "FREE" | "PAID" | "UNKNOWN";

export type DeliveryResult = {
  type: DeliveryType;
  distanceKm: number | null;
  label: string;
  sublabel: string;
};

export function getDeliveryFromCoords(lat: number, lng: number): DeliveryResult {
  const d = haversineKm(SHOP.lat, SHOP.lng, lat, lng);
  const km = Math.round(d * 10) / 10;
  return d <= FREE_KM
    ? { type: "FREE", distanceKm: km, label: "Free Delivery Available", sublabel: `You are ${km} km from our store` }
    : { type: "PAID", distanceKm: km, label: "Delivery Charges May Apply", sublabel: `You are ${km} km from our store` };
}

/**
 * getCurrentPosition's first fix is often a coarse/cached estimate — mobile
 * GPS chips typically refine to a much tighter accuracy over the next few
 * seconds as they lock onto more satellites. This watches for updates for a
 * short window and returns the most accurate reading seen (resolving early
 * once accuracy is already good), instead of settling for whatever arrives
 * first.
 */
export async function getBestPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser"));
      return;
    }
    let best: GeolocationPosition | null = null;
    let settled = false;

    const finish = (pos: GeolocationPosition | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      if (pos) resolve(pos);
      else reject(err instanceof Error ? err : new Error("Unable to determine location"));
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        // Good enough — no need to keep waiting out the full window.
        if (pos.coords.accuracy <= 20) finish(pos);
      },
      (err) => finish(best, err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );

    setTimeout(() => finish(best, new Error("Timed out waiting for a location fix")), timeoutMs);
  });
}

/**
 * Resolves the device's raw GPS coordinates alongside the delivery estimate —
 * callers need the coordinates themselves (not just the estimate) to store as
 * the order's precise delivery location.
 */
export async function getDeliveryFromGeolocation(): Promise<{ delivery: DeliveryResult; lat: number; lng: number }> {
  const { coords } = await getBestPosition();
  return {
    delivery: getDeliveryFromCoords(coords.latitude, coords.longitude),
    lat: coords.latitude,
    lng: coords.longitude,
  };
}
