const EARTH_RADIUS_KM = 6371;

/**
 * Checks whether a location object has finite numeric latitude and longitude.
 */
export const hasValidCoordinates = (location) => {
  return (
    Boolean(location) &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
};

/**
 * Rounds distance in kilometers to 2 decimal places.
 */
export const roundDistanceKm = (distanceKm) => {
  return Math.round(Number(distanceKm) * 100) / 100;
};

/**
 * Calculates great-circle distance in kilometers between two geo points using Haversine.
 * Kept isolated as the distance provider so external routing APIs (OSRM/Google Maps) can replace it cleanly.
 */
export const calculateHaversineDistanceKm = (origin, destination) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};
