$(document).ready(function() {
    var ua_is_mobile = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('Android') !== -1;
    if (ua_is_mobile) {
        $('body').addClass('mobile');
    }
    
    var layers = []

    var layer = null;
    
    var dufour_layer = ga.layer.create('ch.swisstopo.hiks-dufour');
    dufour_layer.setVisible(false);
    layers.push(dufour_layer);
    
    var grey_layer = ga.layer.create('ch.swisstopo.pixelkarte-grau');
    layers.push(grey_layer);
    
    layer = ga.layer.create('ch.swisstopo.swissalti3d-reliefschattierung');
    layer.setOpacity(0.2);
    layers.push(layer);
    
    var colormap_layer = ga.layer.create('ch.swisstopo.pixelkarte-farbe');
    colormap_layer.setVisible(false);
    layers.push(colormap_layer);
    
    var layer = ga.layer.create('ch.swisstopo.swissboundaries3d-land-flaeche.fill');
    layers.push(layer);
    
    var areas_layer = new ol.layer.Vector({
        source: new ol.source.GeoJSON(),
        opacity: 0.7
    });
    areas_layer.set('layer_id', 'areas');
    layers.push(areas_layer);
    
    var area_info = new ol.Overlay({
        element: $('#map_area_info')[0]
    });
    
    var map = new ga.Map({
        tooltip: false,
        target: 'map_canvas',
        layers: layers,
        view: new ol.View2D({
            resolution: 500,
            center: ol.proj.transform([8.25,46.8], 'EPSG:4326', 'EPSG:21781')
        }),
        overlays: [area_info]
    });
    
    map.on('click', function(ev) {
        var feature_selected = null;
        map.forEachFeatureAtPixel(ev.pixel, function(feature, layer) {
            feature_selected = feature;
        });
        
        if (feature_selected) {
            area_info.setPosition(ev.coordinate);
            var popup_content = '<div><b>' + feature_selected.get('geojson_properties').NAME + '</b><br/><img class="geometry" src="http://maps.vasile.ch/swiss-history/static/images/coat-of-arms/' + feature_selected.get('geojson_properties').key + '.png"/></div>';
            $('#map_area_info .ol-popup-content').html(popup_content);
            $('#map_area_info').removeClass('hide');
        } else {
            $('#map_area_info').addClass('hide');
        }
    });
    
    map.on('moveend', function(ev) {
        var resolution = map.getView().getResolution();
        var is_detailed_zoom_level = resolution <= 20;
        
        if (is_detailed_zoom_level) {
            if (dufour_layer.getVisible() === false) {
                dufour_layer.setVisible(true);
            }
            
            if (grey_layer.getVisible()) {
                grey_layer.setVisible(false);
            }
        } else {
            if (dufour_layer.getVisible()) {
                dufour_layer.setVisible(false);
            }
            
            if (grey_layer.getVisible() === false) {
                grey_layer.setVisible(true);
            }
        }
    });
    
    $('#map_area_info .ol-popup-closer').click(function(){
        $('#map_area_info').addClass('hide');
        return false;
    });
    
    $.getJSON('static/json/geometries.geojson', function(data) {
        $.each(data.features, function(k, geojson_feature) {
            var polygon_coordinates = null;
            
            if (geojson_feature.geometry.type === 'Polygon') {
                polygon_coordinates = geojson_feature.geometry.coordinates;
            }
            
            if (geojson_feature.geometry.type === 'MultiPolygon') {
                polygon_coordinates = [];
                $.each(geojson_feature.geometry.coordinates, function(k, group_coordinates) {
                    polygon_coordinates = polygon_coordinates.concat(group_coordinates);
                });
            }
            
            if (polygon_coordinates === null) {
                console.log('Skipping unknown geometry');
                console.log(geojson_feature);
                return;
            }
            
            var paths = [];
            $.each(polygon_coordinates, function(k, path_coordinates) {
                var path = [];
                $.each(path_coordinates, function(k, point_latlng) {
                    var point = ol.proj.transform(point_latlng, 'EPSG:4326', 'EPSG:21781')
                    path.push(point);
                });
                paths.push(path);
            });
            
            var feature = new ol.Feature(new ol.geom.Polygon(paths));
            feature.setId(geojson_feature.properties.key);
            feature.set('geojson_properties', geojson_feature.properties);
            feature.set('isVisible', false);
            var feature_style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: '#' + (Math.random()*0xFFFFFF<<0).toString(16)
                }),
                stroke: new ol.style.Stroke({
                    color: '#000000',
                    width: 2
                })
            });
            feature.setStyle(function(resolution) {
                if (feature.get('isVisible')) {
                    return [feature_style];
                } else {
                    return [];
                }
            });
            
            areas_layer.getSource().addFeature(feature);
        });

        $.getJSON('static/json/events.json', function(data) {
            function updateEvent(k) {
                var event = data[k];
                $('#event').text('Year ' + event.date + ': ' + event.title);
                
                if ((typeof event.notes) === 'undefined') {
                    $('#notes').text('');
                } else {
                    $('#notes').text(event.notes + '. ');
                }
                
                $('#more_info_link').attr('href', event.link);
                
                $.each(areas_layer.getSource().getFeatures(), function(k, feature) {
                    var feature_id = feature.getId();
                    if (event.geometry_ids.indexOf(feature_id) === -1) {
                        if (feature.get('isVisible')) {
                            feature.set('isVisible', false);
                        }                        
                    } else {
                        if (feature.get('isVisible') === false) {
                            feature.set('isVisible', true);
                        }
                    }
                });
                
                // Last event
                if (k === (data.length - 1)) {
                    if (colormap_layer.getVisible() === false) {
                        colormap_layer.setVisible(true);
                    }
                } else {
                    if (colormap_layer.getVisible()) {
                        colormap_layer.setVisible(false);
                    }
                }
            }

            var labels = [];
            var geometry_ids = [];
            $.each(data, function(k, row){
                labels.push(row.date);

                if (typeof(row.add) !== 'undefined') {
                    $.each(row.add, function(k1, id){
                        if (geometry_ids.indexOf(id) === -1) {
                            geometry_ids.push(id);
                        }
                    });
                }

                if (typeof(row.remove) !== 'undefined') {
                    $.each(row.remove, function(k1, id) {
                        var index = geometry_ids.indexOf(id);
                        if (index !== -1) {
                            geometry_ids.splice(index, 1);
                        }
                    });
                }

                data[k].geometry_ids = geometry_ids.slice();
            });

            $('#timeline').labeledslider({
                max: data.length - 1,
                tickLabels: labels,
                value: 0,
                slide: function(event, ui) {
                    updateEvent(ui.value);
                }
            });
            $('#timeline').draggable();

            updateEvent(0);
        });

    });
});