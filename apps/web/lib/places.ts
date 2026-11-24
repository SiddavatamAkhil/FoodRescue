// City centre coordinates for Andhra Pradesh. Used as an approximate location when a
// precise position isn't shared; matching distances are measured from these points.
export const AP_CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Anantapur", lat: 14.6819, lng: 77.6006 },
  { name: "Chittoor", lat: 13.2172, lng: 79.1003 },
  { name: "Eluru", lat: 16.7107, lng: 81.0952 },
  { name: "Guntur", lat: 16.3067, lng: 80.4365 },
  { name: "Kadapa", lat: 14.4673, lng: 78.8242 },
  { name: "Kakinada", lat: 16.9891, lng: 82.2475 },
  { name: "Kurnool", lat: 15.8281, lng: 78.0373 },
  { name: "Machilipatnam", lat: 16.1875, lng: 81.1389 },
  { name: "Nellore", lat: 14.4426, lng: 79.9865 },
  { name: "Ongole", lat: 15.5057, lng: 80.0499 },
  { name: "Rajahmundry", lat: 17.0005, lng: 81.804 },
  { name: "Srikakulam", lat: 18.2949, lng: 83.8938 },
  { name: "Tirupati", lat: 13.6288, lng: 79.4192 },
  { name: "Vijayawada", lat: 16.5062, lng: 80.648 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { name: "Vizianagaram", lat: 18.1067, lng: 83.3956 },
];

export const FOOD_CATEGORIES: { value: string; label: string }[] = [
  { value: "cooked_veg", label: "Cooked food (veg)" },
  { value: "cooked_non_veg", label: "Cooked food (non-veg)" },
  { value: "bakery", label: "Bakery" },
  { value: "dry_rations", label: "Dry rations" },
  { value: "fruits_vegetables", label: "Fruit and vegetables" },
  { value: "dairy", label: "Dairy" },
  { value: "packaged", label: "Packaged food" },
];

export const categoryLabel = (v: string) => FOOD_CATEGORIES.find((c) => c.value === v)?.label ?? v.replace(/_/g, " ");

export const BUSINESS_CATEGORIES = ["Restaurant", "Caterer", "Hotel", "Canteen", "Bakery", "Event venue", "Grocery / retail", "Other"];

export function directionsUrl(from: { lat?: number | null; lng?: number | null } | null, to: { lat: number; lng: number }) {
  // OpenStreetMap directions; opens in the device's browser or maps app.
  const dest = `${to.lat},${to.lng}`;
  if (from?.lat != null && from?.lng != null) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.lat},${from.lng};${dest}`;
  }
  return `https://www.openstreetmap.org/?mlat=${to.lat}&mlon=${to.lng}#map=16/${to.lat}/${to.lng}`;
}
