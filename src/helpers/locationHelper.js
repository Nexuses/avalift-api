// Convert degrees to radians
const toRadians = (degrees) => degrees * Math.PI / 180;

// Calculate approximate distance between two lat/lon points in meters
const equirectangularDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const x = toRadians(lon2 - lon1) * Math.cos((toRadians(lat1) + toRadians(lat2)) / 2);
  const y = toRadians(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * R;
};

// Filter an array of location objects so that each point is at least minDistance away from the previous kept point.
const filterLocations = (locations, minDistance = 30) => {
    if (!Array.isArray(locations) || locations.length === 0) return [];
  
    // Sort by timestamp (assumes each location has a numeric `timestamp` property)
    const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  
    const filtered = [sorted[0]];
    let last = sorted[0];
  
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const dist = equirectangularDistance(
        last.latitude, last.longitude,
        current.latitude, current.longitude
      );
      if (dist >= minDistance) {
        filtered.push(current);
        last = current;
      }
    }
    return filtered;
  };
  

module.exports = {
  toRadians,
  equirectangularDistance,
  filterLocations,
};