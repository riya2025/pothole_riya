/** Light / white map tiles for Leaflet */
export const MAP_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const MAP_TILE_OPTIONS = {
    attribution: '&copy; OSM &copy; CARTO',
    maxZoom: 19,
    subdomains: "abcd" as const,
};
