export const SHOP = { lat: 28.6519, lng: 77.1558, name: "South Patel Nagar, New Delhi - 110008" };
export const FREE_KM = 3;

const PINCODE_COORDS: Record<string, [number, number]> = {
  "110001": [28.6328, 77.2197],
  "110002": [28.6400, 77.2330],
  "110003": [28.6700, 77.2300],
  "110004": [28.6100, 77.2000],
  "110005": [28.6514, 77.1903],
  "110006": [28.6580, 77.2000],
  "110007": [28.6700, 77.1900],
  "110008": [28.6519, 77.1558],
  "110009": [28.6700, 77.1700],
  "110010": [28.6300, 77.1600],
  "110011": [28.6200, 77.1800],
  "110012": [28.6488, 77.1430],
  "110013": [28.6180, 77.2420],
  "110014": [28.5932, 77.2290],
  "110015": [28.6610, 77.1460],
  "110016": [28.5355, 77.2090],
  "110017": [28.5600, 77.2150],
  "110018": [28.6376, 77.1005],
  "110019": [28.5491, 77.2569],
  "110020": [28.5700, 77.2000],
  "110021": [28.5700, 77.1800],
  "110022": [28.5900, 77.2100],
  "110023": [28.6350, 77.1750],
  "110024": [28.5700, 77.2500],
  "110025": [28.5800, 77.2500],
  "110026": [28.6700, 77.1200],
  "110027": [28.6519, 77.1558],
  "110028": [28.6700, 77.1600],
  "110029": [28.6000, 77.2400],
  "110030": [28.5500, 77.1700],
  "110031": [28.7000, 77.2700],
  "110032": [28.6900, 77.2700],
  "110033": [28.7000, 77.1800],
  "110034": [28.7200, 77.1100],
  "110035": [28.6900, 77.1400],
  "110036": [28.7200, 77.1200],
  "110037": [28.5600, 77.1200],
  "110038": [28.5700, 77.1300],
  "110039": [28.7000, 77.2300],
  "110040": [28.7400, 77.1600],
  "110041": [28.7200, 77.0700],
  "110042": [28.7000, 77.1000],
  "110043": [28.6200, 77.0500],
  "110044": [28.5500, 77.3000],
  "110045": [28.6200, 77.0800],
  "110046": [28.6000, 77.0600],
  "110047": [28.5300, 77.2000],
  "110048": [28.5200, 77.2300],
  "110049": [28.5400, 77.2600],
  "110050": [28.6700, 77.0900],
  "110051": [28.7000, 77.2800],
  "110052": [28.7100, 77.1500],
  "110053": [28.6900, 77.1600],
  "110054": [28.6700, 77.2100],
  "110055": [28.6600, 77.2000],
  "110056": [28.6800, 77.2200],
  "110057": [28.5900, 77.1300],
  "110058": [28.6200, 77.0700],
  "110059": [28.6200, 77.0600],
  "110060": [28.6500, 77.0580],
  "110061": [28.5300, 77.3500],
  "110062": [28.5000, 77.2000],
  "110063": [28.6100, 77.0700],
  "110064": [28.6600, 77.0700],
  "110065": [28.5800, 77.2700],
  "110066": [28.5700, 77.2100],
  "110067": [28.5500, 77.2600],
  "110068": [28.5900, 77.1800],
  "110070": [28.5200, 77.0900],
  "110071": [28.5100, 77.0700],
  "110072": [28.5800, 77.0600],
  "110073": [28.7100, 77.0600],
  "110075": [28.5900, 77.0800],
  "110076": [28.5600, 77.3500],
  "110077": [28.5500, 77.0900],
  "110078": [28.6700, 77.0500],
  "110080": [28.6800, 77.0600],
  "110081": [28.6400, 77.0700],
  "110082": [28.7300, 77.0700],
  "110083": [28.7100, 77.0800],
  "110084": [28.7400, 77.0500],
  "110085": [28.6800, 77.0800],
  "110086": [28.7000, 77.0700],
  "110087": [28.6900, 77.0900],
  "110088": [28.7000, 77.0900],
  "110089": [28.7200, 77.0600],
  "110090": [28.7000, 77.3200],
  "110091": [28.7000, 77.3100],
  "110092": [28.7100, 77.3000],
  "110093": [28.6700, 77.3400],
  "110094": [28.6700, 77.3200],
  "110095": [28.6800, 77.3300],
  "110096": [28.6600, 77.3100],
};

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

export function getDeliveryFromPincode(pincode: string): DeliveryResult {
  const coords = PINCODE_COORDS[pincode];
  if (!coords) return { type: "UNKNOWN", distanceKm: null, label: "Delivery availability unknown", sublabel: "Pincode not in our delivery zone database" };
  return getDeliveryFromCoords(coords[0], coords[1]);
}

export async function getDeliveryFromGeolocation(): Promise<DeliveryResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(getDeliveryFromCoords(coords.latitude, coords.longitude)),
      (err) => reject(err),
      { timeout: 10000 },
    );
  });
}
