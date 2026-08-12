import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, isGoogleMapsConfigured } from "../../utils/googleMaps";

interface MapPinPickerProps {
  lat: number;
  lng: number;
  onPositionChange: (lat: number, lng: number) => void;
}

// Remounted (via a `key` on the parent) whenever the customer picks a new
// address suggestion, so it always re-centers on the freshly selected place.
export default function MapPinPicker({ lat, lng, onPositionChange }: MapPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isGoogleMapsConfigured) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;

        const map = new g.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });

        const marker = new g.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
        });

        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (position) onPositionChange(position.lat(), position.lng());
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally mount-once: `lat`/`lng` only seed the initial center/marker
    // position. Re-running this on every position change would fight the
    // customer's own drag and reset the map underneath them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isGoogleMapsConfigured || loadError) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-black/10 bg-[#f8f4ee] px-4 text-center text-xs text-text-muted">
        Map preview unavailable right now — your address and pincode are still used to calculate delivery.
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full overflow-hidden rounded-xl border border-black/10" />;
}
