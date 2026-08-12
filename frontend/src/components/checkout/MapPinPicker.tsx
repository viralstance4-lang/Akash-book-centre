import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useRef } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";

// Leaflet's default marker icon paths break under bundlers (Vite included)
// because they're resolved relative to the CSS file, not the JS bundle.
// Point them at the bundled asset URLs instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapPinPickerProps {
  lat: number;
  lng: number;
  onPositionChange: (lat: number, lng: number) => void;
}

// Remounted (via a `key` on the parent) whenever the customer picks a new
// address suggestion, so it always re-centers on the freshly selected place.
export default function MapPinPicker({ lat, lng, onPositionChange }: MapPinPickerProps) {
  const markerRef = useRef<LeafletMarker>(null);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-xl border border-black/10">
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, lng]}
          draggable
          ref={markerRef}
          eventHandlers={{
            dragend: () => {
              const marker = markerRef.current;
              if (!marker) return;
              const position = marker.getLatLng();
              onPositionChange(position.lat, position.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
