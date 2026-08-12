import { useEffect, useRef, useState } from "react";

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

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    "ISO3166-2-lvl4"?: string;
  };
};

const DEBOUNCE_MS = 500;
// Nominatim's usage policy caps unauthenticated clients at 1 request/second;
// the 500ms debounce already keeps us well under that.
const MIN_QUERY_LENGTH = 4;

// Nominatim frequently omits `address.state` for Union Territories (Delhi,
// Chandigarh, Puducherry, ...) and sometimes for other results too — it still
// gives the ISO 3166-2 subdivision code, so fall back to that.
const INDIA_ISO_STATE: Record<string, string> = {
  AN: "Andaman and Nicobar Islands", AP: "Andhra Pradesh", AR: "Arunachal Pradesh",
  AS: "Assam", BR: "Bihar", CH: "Chandigarh", CT: "Chhattisgarh",
  DN: "Dadra and Nagar Haveli and Daman and Diu", DL: "Delhi", GA: "Goa",
  GJ: "Gujarat", HR: "Haryana", HP: "Himachal Pradesh", JK: "Jammu and Kashmir",
  JH: "Jharkhand", KA: "Karnataka", KL: "Kerala", LA: "Ladakh", LD: "Lakshadweep",
  MP: "Madhya Pradesh", MH: "Maharashtra", MN: "Manipur", ML: "Meghalaya",
  MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PY: "Puducherry", PB: "Punjab",
  RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu", TG: "Telangana",
  TR: "Tripura", UP: "Uttar Pradesh", UT: "Uttarakhand", WB: "West Bengal",
};

export function toPlaceSelection(result: NominatimResult): PlaceSelection {
  const addr = result.address ?? {};
  const line1Parts = [addr.house_number, addr.road, addr.neighbourhood ?? addr.suburb].filter(Boolean);
  const isoState = addr["ISO3166-2-lvl4"]?.startsWith("IN-")
    ? INDIA_ISO_STATE[addr["ISO3166-2-lvl4"].slice(3)]
    : undefined;
  return {
    line1: line1Parts.join(", ") || result.display_name,
    city: addr.city ?? addr.town ?? addr.village ?? addr.county,
    state: addr.state ?? isoState,
    pincode: addr.postcode,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

/** Reverse-geocodes GPS coordinates into a postal address via Nominatim. */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceSelection> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data: NominatimResult = await res.json();
  // Keep the device's exact coordinates rather than Nominatim's (possibly rounded) ones.
  return { ...toPlaceSelection(data), lat, lng };
}

// Falls back to a plain text input with no suggestions if Nominatim is
// unreachable — manual entry always keeps working either way.
export default function AddressAutocomplete({ value, onChange, onPlaceSelected, placeholder, className }: AddressAutocompleteProps) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Distinct from "no results" so a blocked/failed request (ad-blocker,
  // network filter, offline) is visible instead of looking like silence.
  const [fetchError, setFetchError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setFetchError(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setFetchError(false);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&addressdetails=1&limit=5`;
        const res = await fetch(url, {
          signal: controller.signal,
          // Browsers won't let JS override User-Agent; Nominatim's usage
          // policy accepts the browser's own Referer header as identification
          // for client-side apps instead.
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Nominatim request failed");
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch (err) {
        // Aborted requests (superseded by a newer keystroke) aren't errors.
        if ((err as Error).name !== "AbortError") setFetchError(true);
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSelect = (result: NominatimResult) => {
    const place = toPlaceSelection(result);
    skipNextSearchRef.current = true;
    setResults([]);
    setOpen(false);
    onChange(place.line1);
    onPlaceSelected(place);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1 text-sm shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="block w-full px-4 py-2.5 text-left text-text-primary hover:bg-[#f8f4ee]"
              >
                {r.display_name}
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
          Couldn't fetch address suggestions (network/ad-blocker?) — you can still type your full address manually.
        </p>
      )}
    </div>
  );
}
