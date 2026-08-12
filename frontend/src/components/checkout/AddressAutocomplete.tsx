import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, isGoogleMapsConfigured } from "../../utils/googleMaps";

export type PlaceSelection = {
  line1: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
};

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

function getComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
): string | undefined {
  return components?.find((c) => c.types.includes(type))?.long_name;
}

function toPlaceSelection(place: {
  address_components?: google.maps.GeocoderAddressComponent[];
  formatted_address?: string;
  name?: string;
  geometry?: { location?: google.maps.LatLng | null };
}): PlaceSelection {
  const components = place.address_components;
  const line1Parts = [
    getComponent(components, "street_number"),
    getComponent(components, "route"),
    getComponent(components, "sublocality") ?? getComponent(components, "sublocality_level_1"),
  ].filter(Boolean);
  const loc = place.geometry?.location;
  return {
    line1: line1Parts.join(", ") || place.formatted_address || place.name || "",
    city: getComponent(components, "locality") ?? getComponent(components, "administrative_area_level_2"),
    state: getComponent(components, "administrative_area_level_1"),
    pincode: getComponent(components, "postal_code"),
    lat: loc?.lat(),
    lng: loc?.lng(),
  };
}

/** Reverse-geocodes GPS coordinates into a postal address via the Google Geocoding API. */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceSelection> {
  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();
  const { results } = await geocoder.geocode({ location: { lat, lng } });
  const result = results[0];
  if (!result) throw new Error("Reverse geocoding failed");
  // Keep the device's exact coordinates rather than the geocoder's (possibly rounded) ones.
  return { ...toPlaceSelection(result), lat, lng };
}

// Falls back to a plain text input with no suggestions if Google Maps isn't
// configured or unreachable — manual entry always keeps working either way.
export default function AddressAutocomplete({ value, onChange, onPlaceSelected, placeholder, className }: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Distinct from "no results" so a missing/invalid API key or network issue
  // is visible instead of looking like silence.
  const [fetchError, setFetchError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearchRef = useRef(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  // Google bills autocomplete session-based (predictions + the details fetch
  // that follows) rather than per-keystroke — reusing one token per "session"
  // (until a place is picked) keeps cost down.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isGoogleMapsConfigured) {
      setFetchError(true);
      return;
    }
    loadGoogleMaps()
      .then((g) => {
        autocompleteServiceRef.current = new g.maps.places.AutocompleteService();
        // PlacesService needs a map or DOM node to attach to, but never renders
        // one visibly — an off-DOM div is the standard way to use it headlessly.
        placesServiceRef.current = new g.maps.places.PlacesService(document.createElement("div"));
      })
      .catch(() => setFetchError(true));
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const service = autocompleteServiceRef.current;
      if (!service) return;
      setLoading(true);
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "in" },
          sessionToken: sessionTokenRef.current,
        },
        (results, status) => {
          setLoading(false);
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
            if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) setFetchError(true);
            setPredictions([]);
            setOpen(false);
            return;
          }
          setFetchError(false);
          setPredictions(results);
          setOpen(results.length > 0);
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const service = placesServiceRef.current;
    if (!service) return;
    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["address_components", "formatted_address", "geometry", "name"],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (place, status) => {
        sessionTokenRef.current = null; // session ends once details are fetched
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) return;
        const selection = toPlaceSelection(place);
        skipNextSearchRef.current = true;
        setPredictions([]);
        setOpen(false);
        onChange(selection.line1);
        onPlaceSelected(selection);
      },
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1 text-sm shadow-lg">
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="block w-full px-4 py-2.5 text-left text-text-primary hover:bg-[#f8f4ee]"
              >
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
        </div>
      )}
      {fetchError && !loading && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          Couldn't fetch address suggestions — you can still type your full address manually.
        </p>
      )}
    </div>
  );
}
