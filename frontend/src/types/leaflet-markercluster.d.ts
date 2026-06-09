import "leaflet";

declare module "leaflet" {
    interface MarkerClusterGroupOptions {
        maxClusterRadius?: number;
        spiderfyOnMaxZoom?: boolean;
        showCoverageOnHover?: boolean;
    }

    interface MarkerClusterGroup extends L.FeatureGroup {
        clearLayers(): this;
        addLayer(layer: L.Layer): this;
    }

    function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}
