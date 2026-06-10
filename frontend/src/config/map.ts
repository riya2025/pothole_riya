/** Shared Leaflet light map tiles (white / clean civic style) */
export const MAP_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export const MAP_TILE_OPTIONS = {
    attribution: MAP_TILE_ATTRIBUTION,
    maxZoom: 19,
    subdomains: "abcd" as const,
};
