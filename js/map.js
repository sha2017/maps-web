var wikiUrl = "https://orga.sha2017.org/";
var wikiDataUrl = wikiUrl + "api.php?action=askargs&printouts=Summary&format=json&callback=callback&conditions=Handle::0x";
var map, base_layers, overlay_layers;

function isMobile() {
    try{ document.createEvent("TouchEvent"); return true; }
    catch(e){ return false; }
}

$(function() {
  $.getJSON('config.json', createMap);
});

function createMap(config) {
    base_layers = new ol.layer.Group({
        title: 'Base Layers',
        layers: [
            new ol.layer.Tile({ title: "Blank", type: 'base'}),
            new ol.layer.Tile({ title: "OSM", type: 'base', source: new ol.source.OSM() }),
        ]
    });

    overlay_layers = new ol.layer.Group({
        title: 'Overlays', layers: []
    });

    map = new ol.Map({
        layers: [base_layers, overlay_layers],
        target: 'map',
        controls: ol.control.defaults({
            attributionOptions: ({
              collapsible: false
             })
         }),
          view: new ol.View({
              center: (new ol.geom.Point([5.52579, 52.28488])).transform('EPSG:4326', 'EPSG:3857').getCoordinates(),
              zoom: 17,
              minZoom: config.zoom_range[0],
              maxZoom: config.zoom_range[1]
          })
    });

    var layerSwitcher = new ol.control.LayerSwitcher();
    map.addControl(layerSwitcher);

    $.getJSON('vector_layers.json', addVectorLayers);

    config.layers.forEach(function(layer) {
      var layer = new ol.layer.Tile({
        title: layer.name,
        visible: layer.visible,
        source: new ol.source.XYZ({
          url: 'tiles/' + layer.path + '/{z}/{x}/{y}.png'
        }),
        minZoom: config.zoom_range[0],
        maxZoom: config.zoom_range[1]

      });
      overlay_layers.getLayers().push(layer);
    });

    // The <canvas> element doesn't seem to get sized correctly
    // on page load, which causes vector element hover to break.
    // Update the size after a small delay.
    setTimeout( function() { map.updateSize();}, 50);
}

function generateStyle(style, props, resolution) {
  data = {}
  if ("line-color" in style) {
    data['stroke'] = new ol.style.Stroke({
      color: style['line-color'],
      width: style['line-width']
    });
  }

  if ("polygon-fill" in style) {
    data['fill'] = new ol.style.Fill({
      color: style['polygon-fill']
    });
  }

  if ("z-index" in style) {
    data['zIndex'] = style['z-index'];
  }

  if ("text-color" in style && "text" in props) {
    data['text'] = new ol.style.Text({
      text: props['text'],
      textAlign: 'center',
      scale: props['text_size'] / 5 / resolution,
      rotation: props['text_rotation'] !== undefined ? (-props['text_rotation'] / 180.0 * Math.PI) : 0,
      rotateWithView: true,
    });
  }

  return new ol.style.Style(data);
}

function addVectorLayers(layer_data) {

    function styleFunction(feature, resolution) {
      console.log(resolution)
      var props = feature.getProperties();
      for (var rule in layer_data.styles) {
        for (var key in layer_data.styles[rule]['match']) {
          if (key in props && props[key] == layer_data.styles[rule]['match'][key]) {
            return generateStyle(layer_data.styles[rule]['style'], props, resolution);
          }
        }
      }
    }

    $.each(layer_data.layers, function(index, layer) {
        var vectorSource = new ol.source.Vector({
            url: 'vector/' + layer.source,
            format: new ol.format.GeoJSON()
        });

        var vectorLayer = new ol.layer.Vector({
            title: layer.name,
            source: vectorSource,
            visible: layer.visible,
            style: styleFunction,
            updateWhileAnimating: !isMobile(),
            updateWhileInteracting: !isMobile()
        });
        overlay_layers.getLayers().push(vectorLayer);
    });

    addPopupActions(map);
}

function addPopupActions(map) {
    // Highlight element on hover:
    var hoverAction = new ol.interaction.Select({condition: ol.events.condition.pointerMove});
    map.addInteraction(hoverAction);

    return;

    var container = document.getElementById('popup');
    var content = document.getElementById('popup-content');
    var closer = document.getElementById('popup-closer');
    var overlay = new ol.Overlay(/** @type {olx.OverlayOptions} */ ({
      element: container,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    }));
    map.addOverlay(overlay);

    closer.onclick = function() {
      overlay.setPosition(undefined);
      closer.blur();
      return false;
    };

    // Display popup on click
    var clickAction = new ol.interaction.Select();
    map.addInteraction(clickAction);
    clickAction.on('select', function(e) {
      if (e.selected.length > 0){
        var coordinate = e.mapBrowserEvent.coordinate;
        props = e.selected[0].getProperties();
        var html = '<strong>Layer:</strong> ' + props['layer'] + "<br><strong>Handle:</strong> 0x" + props['entityhandle'] + "<br>";
        content.innerHTML = html;
        overlay.setPosition(coordinate);

        var url = wikiDataUrl + props['entityhandle'];
        $.ajax(url, {
          dataType: "jsonp",
          jsonp: "callback",
          success: function(data) {
            if (Object.keys(data.query.results).length == 0) {
              html += "<p>This object is not yet defined in the wiki. If there is an page on the <a href='" + wikiUrl + "' target='_new'>wiki</a> representing this object, add the following snippet to that page:</p>";
              html += "<pre>{{MapObject\n|Name = OBJECT NAME\n|Handle = 0x" + props['entityhandle'] + "\n|Summary = SUMMARY OF THIS OBJECT THAT IS SHOWN HERE.\n}}</pre>";
            } else {
              html = "";
              $.each(data.query.results, function(index, item) {
                if('printouts' in item) {
                  html += "<a href='" + item.fullurl + "' target='_new'>" + item.fulltext + "</a><br>";
                  html += item.printouts.Summary[0].fulltext + "<br>";
                }
              });
            }
            content.innerHTML = html;
          },
          error: function() {
            content.innerHTML = html + "<p>Wiki-data is currently unavailable</p>";
          }
        });
      }
      clickAction.getFeatures().clear()
    });
}

