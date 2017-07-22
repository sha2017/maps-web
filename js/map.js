var wikiUrl = "https://wiki.sha2017.org/";
var wikiApi = wikiUrl + "api.php";
var map, base_layers, overlay_layers;

var popupsEnabled = { enabled: true };

function isMobile() {
	try {
		document.createEvent("TouchEvent");
		return true;
	}
	catch (e) {
		return false;
	}
}

$(function () {
	$.getJSON('config.json', createMap);
});

function createMap(config) {
	
	base_layers = new ol.layer.Group({
		title: 'Base Layers',
		layers: [
			new ol.layer.Tile({title: "Blank", type: 'base'}),
			new ol.layer.Tile({title: "OSM", type: 'base', source: new ol.source.OSM()}),
		]
	});
	
	overlay_layers = new ol.layer.Group({
		title: 'Overlays', layers: []
	});
	
	measurement_layers = new ol.layer.Group({
		layers: []
	});
	
	map = new ol.Map({
		layers: [base_layers, overlay_layers, measurement_layers],
		target: 'map',
		controls: ol.control.defaults({
			attributionOptions: ({
				collapsible: false
			})
		}).extend([new ol.control.ScaleLine()]),
		view: new ol.View({
			center: (new ol.geom.Point([5.52579, 52.28488])).transform('EPSG:4326', 'EPSG:3857').getCoordinates(),
			zoom: 17,
			minZoom: config.zoom_range[0],
			maxZoom: config.zoom_range[1]
		})
	});
	
	initMeasurements(map, measurement_layers, popupsEnabled);
	
	var layerSwitcher = new ol.control.LayerSwitcher();
	map.addControl(layerSwitcher);
	
	$.getJSON('vector_layers.json', addVectorLayers);
	
	addGeoLocation(map);
	
	config.layers.forEach(function (layer) {
		var layerTile = new ol.layer.Tile({
			title: layer.name,
			visible: layer.visible,
			source: new ol.source.XYZ({
				url: 'tiles/' + layer.path + '/{z}/{x}/{y}.png'
			}),
			minZoom: config.zoom_range[0],
			maxZoom: config.zoom_range[1]
			
		});
		overlay_layers.getLayers().push(layerTile);
	});
	
	// The <canvas> element doesn't seem to get sized correctly
	// on page load, which causes vector element hover to break.
	// Update the size after a small delay.
	setTimeout(function () {
		map.updateSize();
	}, 50);
}

function generateStyle(style, props, resolution) {
	var data = {};
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
			fill: new ol.style.Fill({ color: style['text-color'] })
		});
	}
	
	return new ol.style.Style(data);
}

function addVectorLayers(layer_data) {
	$.each(layer_data.layers, function (index, layer) {
		var vectorSource = new ol.source.Vector({
			url: 'vector/' + layer.source,
			format: new ol.format.GeoJSON()
		});
		
		var vectorLayer = new ol.layer.Vector({
			title: layer.name,
			source: vectorSource,
			visible: layer.visible,
			style: function(feature, resolution) {
				var props = feature.getProperties();
				return generateStyle(layer_data.styles[layer.name][props['layer']], props, resolution);
			},
			updateWhileAnimating: !isMobile(),
			updateWhileInteracting: !isMobile()
		});
		vectorLayer.setZIndex(layer['z-index']);
		overlay_layers.getLayers().push(vectorLayer);
	});
	
	addPopupActions(map, layer_data);
}

function addGeoLocation(map) {
	var geolocation = new ol.Geolocation({ projection: map.getView().getProjection() });
	geolocation.setTracking(true);
	
	var positionFeature = new ol.Feature();
	positionFeature.setStyle(new ol.style.Style({
		image: new ol.style.Circle({
			radius: 6,
			fill: new ol.style.Fill({ color: '#3399CC' }),
			stroke: new ol.style.Stroke({ color: '#fff' })
		})
	}));
	geolocation.on('change:position', function() {
		console.log('Position: ' + geolocation.getPosition());
		var coordinates = geolocation.getPosition();
		positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
	});
	
	var accuracyFeature = new ol.Feature();
	geolocation.on('change:accuracyGeometry', function() {
		console.log('Accuracy: ' + geolocation.getAccuracyGeometry());
		accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
	});
	
	new ol.layer.Vector({
		map: map,
		source: new ol.source.Vector({ features: [accuracyFeature, positionFeature] })
	});
}
/*
      function el(id) {
        return document.getElementById(id);
      }

      el('track').addEventListener('change', function() {
        geolocation.setTracking(this.checked);
      });

      // update the HTML page when the position changes.
      geolocation.on('change', function() {
        el('accuracy').innerText = geolocation.getAccuracy() + ' [m]';
        el('altitude').innerText = geolocation.getAltitude() + ' [m]';
        el('altitudeAccuracy').innerText = geolocation.getAltitudeAccuracy() + ' [m]';
        el('heading').innerText = geolocation.getHeading() + ' [rad]';
        el('speed').innerText = geolocation.getSpeed() + ' [m/s]';
      });

      // handle geolocation error.
      geolocation.on('error', function(error) {
        var info = document.getElementById('info');
        info.innerHTML = error.message;
        info.style.display = '';
      });

      var accuracyFeature = new ol.Feature();
      geolocation.on('change:accuracyGeometry', function() {
        accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
      });

      var positionFeature = new ol.Feature();
      positionFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({
            color: '#3399CC'
          }),
          stroke: new ol.style.Stroke({
            color: '#fff',
            width: 2
          })
        })
      }));

      geolocation.on('change:position', function() {
        var coordinates = geolocation.getPosition();
        positionFeature.setGeometry(coordinates ?
            new ol.geom.Point(coordinates) : null);
      });

      new ol.layer.Vector({
        map: map,
        source: new ol.source.Vector({
          features: [accuracyFeature, positionFeature]
        })
}
*/

function addPopupActions(map, layer_data) {
	// Highlight element on hover:
	var hoverAction = new ol.interaction.Select({
		condition: ol.events.condition.pointerMove,
		filter: function(feature, layer) {
			if (layer === null) {
				return false;
			}
			var style = layer_data.styles[layer.getProperties()['title']][feature.getProperties()['layer']];
			if ('selectable' in style && !style['selectable']) {
				return false;
			}
			if (feature.getGeometry().getType() == "Point" && 'text-selectable' in style && !style['text-selectable']) {
				return false;
			}
			return true;
		}
	});
	map.addInteraction(hoverAction);
	
	var container = $('#popup');
	var content = $('#popup-content');
	var closer = $('#popup-closer');
	
	var otherElementsThatHaveToBeMovedToTheLeft = $('.layer-switcher, .measurement-tool, .ol-attribution');
	
	closer.click(function () {
		container.css("right", "-400px");
		otherElementsThatHaveToBeMovedToTheLeft.css("right", "");
		this.blur();
		return false;
	});
	
	// Display popup on click
	var clickAction = new ol.interaction.Select({
		filter: function(feature, layer) {
			if (layer === null) {
				return false;
			}
			var style = layer_data.styles[layer.getProperties()['title']][feature.getProperties()['layer']];
			if ('selectable' in style && !style['selectable']) {
				return false;
			}
			if (feature.getGeometry().getType() == "Point" && 'text-selectable' in style && !style['text-selectable']) {
				return false;
			}
			return true;
		}
	});
	map.addInteraction(clickAction);
	clickAction.on('select', function (e) {
		if(!popupsEnabled.enabled) {
			return;
		}
		if (e.selected.length > 0) {
			var props = e.selected[0].getProperties();
			if(!props['layer']) {
				return;
			}
			var html = "<img src='img/loading.gif' alt='loading' class='loading'>";
			content.html(html);
			container.css("right", "0");
			otherElementsThatHaveToBeMovedToTheLeft.css("right", "407px");
			
			$.ajax({
				url: wikiApi + "?action=askargs&printouts=Summary&format=json&conditions=Handle::0x" + props['entityhandle'],
				dataType: "jsonp",
				jsonp: "callback",
				success: function (data) {
					content.html("");
					if (Object.keys(data.query.results).length == 0) {
						html = '<strong>Layer:</strong> ' + props['layer'] + "<br>";
						html += "<p>This object is not yet defined in the wiki. If there is an page on the <a href='" + wikiUrl + "' target='_new'>wiki</a> representing this object, add the following snippet to that page:</p>";
						html += "<pre>{{MapObject|Handle = 0x" + props['entityhandle'] + "}}</pre>";
						if('Form' in props && 'Template' in props) {
							html += "Or create a page by typing the name here:";
							html += "<form id='form-" + props['entityhandle'] + "' onsubmit='return createWithForm(\"" + props['entityhandle'] + "\", \"" + props['Form'] + "\", \"" + props['Template'] + "\")' target='_blank'>";
							html += "<input type='text' value='' name='name' class='name'>";
							html += "<input type='hidden' value='0x" + props['entityhandle'] + "' name='" + props['Template'] + "[handle]' class='hidden'>";
							html += "<input type='submit' value='Create'>";
							html += "</form>";
						}
						content.html(html);
					} else {
						$.each(data.query.results, function (index, item) {
							if ('printouts' in item) {
								$.ajax({
									url: wikiApi + "?action=parse&format=json&page=" + item.fulltext,
									dataType: "jsonp",
									jsonp: "callback",
									cache: false,
									success: function (data) {
										html = "<div class='mw-body'>";
										html += "<h1 id='firstHeading'><a href='" + item.fullurl + "' target='_blank'>" + item.fulltext + "</a></h1>";
										html += data.parse.text["*"];
										html += "</div>";
										html += "<script>fixRelativeUrls()</script>";
										content.html(content.html() + html);
									},
									error: function (req, error1, error2) {
										html = "<p>Wiki-page <a href='" + item.fullurl + "' target='_blank'>" + item.fulltext + "</a> is currently unavailable</p>";
										content.html(content.html() + html);
									}
								});
							}
						});
					}
				},
				error: function () {
					html = '<strong>Layer:</strong> ' + props['layer'] + "<br>";
					html += "<p>The wiki-data is currently unavailable. If there is an page on the <a href='" + wikiUrl + "' target='_new'>wiki</a> representing this object, add the following snippet to that page:</p>";
					html += "<pre>{{MapObject|Handle = 0x" + props['entityhandle'] + "}}</pre>";
					content.html(html);
				}
			});
		}
		clickAction.getFeatures().clear()
	});
}

function createWithForm(handle, form, template)
{
	const inputform = $("#form-" + handle);
	name = inputform.find("input.name").val();
	url = wikiUrl + "w/Special:FormEdit/" + form + "/" + name;
	inputform.attr('action', url);
	return true;
}

function fixRelativeUrls()
{
	$(".mw-body a").each(function() {
		url = $(this).attr('href');
		if(url.substr(0, 1) == "/") {
			url = wikiUrl + url.substr(1);
			$(this).attr('href', url);
		}
		$(this).attr('target', '_blank');
	});
	createSHAFlag();
}
