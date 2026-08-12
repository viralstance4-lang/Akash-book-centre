const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const isGoogleMapsConfigured = Boolean(
  API_KEY && API_KEY !== "your_google_maps_api_key",
);

let loadPromise: Promise<typeof google> | null = null;

/**
 * Injects the Google Maps JS SDK (core + Places library) exactly once and
 * resolves once it's ready. Every caller (map, autocomplete, geocoder) shares
 * this single promise instead of racing to load the script independently.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!isGoogleMapsConfigured) {
      reject(new Error("Google Maps API key is not configured"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const callbackName = "__googleMapsReady";
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      resolve(window.google);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY!)}&libraries=places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps — check the API key and network connection."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
