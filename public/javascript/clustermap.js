mapboxgl.accessToken = mapToken;
const map = new mapboxgl.Map({
    container: 'cluster-map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [108.00, 14.0583], 
    zoom: 8, // Bạn có thể tăng lên 6 nếu muốn nhìn gần hơn
    maxBounds: [
        [90.00, 5.00],   // <--- SỬA LẠI: Mở rộng góc dưới bên trái (Sang tận Thái Lan/Biển)
        [125.00, 25.00]  // <--- SỬA LẠI: Mở rộng góc trên bên phải (Ra xa ngoài Biển Đông)
    ]
});
const nav = new mapboxgl.NavigationControl();

map.addControl(nav, "top-right");

map.on("load", () => {
  // Add a new source from our GeoJSON data and
  // set the 'cluster' option to true. GL-JS will
  // add the point_count property to your source data.
  map.addSource("campgrounds", {
    type: "geojson",
    generateId: true,
    // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
    // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
    data: campgrounds,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points on
    clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "campgrounds",
    filter: ["has", "point_count"],
    paint: {
      // Use step expressions (https://docs.mapbox.com/style-spec/reference/expressions/#step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 100
      //   * Yellow, 30px circles when point count is between 100 and 750
      //   * Pink, 40px circles when point count is greater than or equal to 750
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#51bbd6",
        10,
        "#f1f075",
        30,
        "#f28cb1",
      ],
      "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 30, 40],
      "circle-emissive-strength": 1,
    },
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "campgrounds",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 12,
    },
  });

  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: "campgrounds",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#11b4da",
      "circle-radius": 4,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff",
      "circle-emissive-strength": 1,
    },
  });

  // When a click event occurs on a cluster,
  // getClusterExpansionZoom grabs the zoomlevel where the cluster expands
  // Then the viewport zooms in to show the expanded cluster
  // Displaying the underlying individual points and/or smaller clusters
  map.addInteraction("click-clusters", {
    type: "click",
    target: { layerId: "clusters" },
    handler: (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      const clusterId = features[0].properties.cluster_id;
      map
        .getSource("campgrounds")
        .getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;

          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
          });
        });
    },
  });

  // When a click event occurs on a feature in
  // the unclustered-point layer, open a popup at
  // the location of the feature, with
  // description HTML from its properties.
  map.addInteraction("click-unclustered-point", {
    type: "click",
    target: { layerId: "unclustered-point" },
    handler: (e) => {
      const { popUpMarkup } = e.feature.properties;
      const coordinates = e.feature.geometry.coordinates.slice();

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popUpMarkup)
        .addTo(map);
    },
  });

  // Change the cursor to a pointer when the mouse is over a cluster of POIs.
  map.addInteraction("clusters-mouseenter", {
    type: "mouseenter",
    target: { layerId: "clusters" },
    handler: () => {
      map.getCanvas().style.cursor = "pointer";
    },
  });

  // Change the cursor back to a pointer when it stops hovering over a cluster of POIs.
  map.addInteraction("clusters-mouseleave", {
    type: "mouseleave",
    target: { layerId: "clusters" },
    handler: () => {
      map.getCanvas().style.cursor = "";
    },
  });

  // Change the cursor to a pointer when the mouse is over an individual POI.
  map.addInteraction("unclustered-mouseenter", {
    type: "mouseenter",
    target: { layerId: "unclustered-point" },
    handler: () => {
      map.getCanvas().style.cursor = "pointer";
    },
  });

  // Change the cursor back to a pointer when it stops hovering over an individual POI.
  map.addInteraction("unclustered-mouseleave", {
    type: "mouseleave",
    target: { layerId: "unclustered-point" },
    handler: () => {
      map.getCanvas().style.cursor = "";
    },
  });
});
if (campgrounds.features.length > 0) {
    const bounds = new mapboxgl.LngLatBounds();

    // Duyệt qua tất cả các quán ăn trong kết quả tìm kiếm để lấy tọa độ
    campgrounds.features.forEach(function (feature) {
        bounds.extend(feature.geometry.coordinates);
    });

    // Ép bản đồ co giãn (fit) để hiển thị vừa khít tất cả các quán vừa tìm được
    map.fitBounds(bounds, {
        padding: 50,  // Khoảng cách đệm (để chấm không bị sát mép bản đồ quá)
        maxZoom: 15,  // Mức zoom tối đa (tránh zoom quá sát nếu chỉ có 1 quán)
        duration: 1000 // Hiệu ứng lướt tới trong 1 giây (nhìn cho mượt)
    });
}