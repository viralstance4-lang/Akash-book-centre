import env from "../../config/env";
import logger from "../../config/logger";

/** Fixed store location — origin point for all delivery-distance calculations. */
export const STORE_LOCATION = {
  address: env.STORE_ADDRESS,
  lat: env.STORE_LATITUDE,
  lng: env.STORE_LONGITUDE,
};

export type DistanceCalculationMethod = "GOOGLE_DISTANCE_MATRIX" | "HAVERSINE";

export class DistanceCalculationError extends Error {
  code: "MISSING_COORDINATES" | "INVALID_COORDINATES";
  constructor(message: string, code: "MISSING_COORDINATES" | "INVALID_COORDINATES") {
    super(message);
    this.name = "DistanceCalculationError";
    this.code = code;
  }
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calls Google's Distance Matrix API for a driving-distance estimate.
 * Returns null (never throws) on any failure so the caller can fall back to Haversine —
 * a Google-side outage or missing key must never block checkout.
 */
async function viaGoogleDistanceMatrix(destLat: number, destLng: number): Promise<number | null> {
  if (!env.GOOGLE_MAPS_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const origin = `${STORE_LOCATION.lat},${STORE_LOCATION.lng}`;
    const destination = `${destLat},${destLng}`;
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric` +
      `&origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}` +
      `&key=${env.GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      logger.warn({ status: res.status }, "[DISTANCE] Google Distance Matrix HTTP error — falling back to Haversine");
      return null;
    }

    const data: any = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (data?.status !== "OK" || !element || element.status !== "OK") {
      logger.warn({ status: data?.status, elementStatus: element?.status }, "[DISTANCE] Google Distance Matrix returned no route — falling back to Haversine");
      return null;
    }

    return element.distance.value / 1000; // meters → km
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[DISTANCE] Google Distance Matrix request failed — falling back to Haversine");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export class DistanceService {
  /**
   * Calculates delivery distance from the store to the given coordinates.
   * Prefers Google Distance Matrix when GOOGLE_MAPS_API_KEY is configured; otherwise
   * (or on any Google failure) falls back to the Haversine straight-line formula.
   */
  static async calculateDistance(
    destLat: number,
    destLng: number,
  ): Promise<{ distanceKm: number; method: DistanceCalculationMethod }> {
    if (typeof destLat !== "number" || typeof destLng !== "number" || Number.isNaN(destLat) || Number.isNaN(destLng)) {
      throw new DistanceCalculationError("Missing delivery coordinates", "MISSING_COORDINATES");
    }
    if (destLat < -90 || destLat > 90 || destLng < -180 || destLng > 180) {
      throw new DistanceCalculationError("Delivery coordinates out of range", "INVALID_COORDINATES");
    }

    const googleKm = await viaGoogleDistanceMatrix(destLat, destLng);
    if (googleKm !== null) {
      return { distanceKm: googleKm, method: "GOOGLE_DISTANCE_MATRIX" };
    }

    return {
      distanceKm: haversineKm(STORE_LOCATION.lat, STORE_LOCATION.lng, destLat, destLng),
      method: "HAVERSINE",
    };
  }
}
