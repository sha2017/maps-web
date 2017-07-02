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

function getPosition() {
	// Fetch the position from the URL anchor, or return the default
	if (window.location.hash !== '') {
		var hash = window.location.hash.replace('#map=', '');
		var parts = hash.split('/');
		if (parts.length === 4) {
			zoom = parseInt(parts[0], 10);
			center = [
			    parseFloat(parts[1]),
			    parseFloat(parts[2])
			];
			rotation = parseFloat(parts[3]);
			return {'zoom': zoom, 'center': center, 'rotation': rotation}
		}
	}
	return {'zoom': 17, 'center': [5.52579, 52.28488], 'rotation': 0}
}

var shouldUpdate = true;

function updatePermalink() {
	// Called when the map position is moved to update the permalink and window state
	if (!shouldUpdate) {
          // do not update the URL when the view was changed in the 'popstate' handler
          shouldUpdate = true;
          return;
	}
	var view = map.getView();
	var center = (new ol.geom.Point(view.getCenter())).transform('EPSG:3857', 'EPSG:4326').getCoordinates();
	var hash = '#map=' +
            	view.getZoom() + '/' +
            	Math.round(center[0] * 10000) / 10000 + '/' +
            	Math.round(center[1] * 10000) / 10000 + '/' +
		view.getRotation();
	// NB: We're storing the EPSG:3857 coords in the state hash, but the URL uses EPSG:4326
	var state = {
        	zoom: view.getZoom(),
          	center: view.getCenter(),
          	rotation: view.getRotation()
        };
        window.history.pushState(state, 'map', hash);
}

function popState(event) {
	// Handle a back button press
	if (event.state === null) {
          return;
        }
        map.getView().setCenter(event.state.center);
        map.getView().setZoom(event.state.zoom);
        map.getView().setRotation(event.state.rotation);
        shouldUpdate = false;
}

function createMap(config) {
	base_layers = new ol.layer.Group({
		title: 'Base Layers',
		layers: [
			new ol.layer.Tile({title: "Blank", type: 'base'}),
			new ol.layer.Tile({
				title: "Aerial Imagery", type: 'base',
				source: new ol.source.OSM({
					attributions: 'Kadaster / <a href="http://www.beeldmateriaal.nl/">Beeldmateriaal.nl</a>, CC BY 4.0',
					url: 'https://geodata.nationaalgeoregister.nl/luchtfoto/wmts?FORMAT=image/jpeg&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=2016_ortho25&STYLE=&FORMAT=image/jpeg&tileMatrixSet=OGC:1.0:GoogleMapsCompatible&tileMatrix={z}&tileRow={y}&tileCol={x}',
				})
			}),
			new ol.layer.Tile({title: "OSM", type: 'base', source: new ol.source.OSM()}),
		]
	});
	
	overlay_layers = new ol.layer.Group({
		title: 'Overlays', layers: []
	});
	
	measurement_layers = new ol.layer.Group({
		layers: []
	});

	position = getPosition();
	map = new ol.Map({
		layers: [base_layers, overlay_layers, measurement_layers],
		target: 'map',
		controls: ol.control.defaults({
			attributionOptions: ({
				collapsible: false
			})
		}).extend([new ol.control.ScaleLine()]),
		view: new ol.View({
			center: (new ol.geom.Point(position['center'])).transform('EPSG:4326', 'EPSG:3857').getCoordinates(),
			zoom: position['zoom'],
			minZoom: config.zoom_range[0],
			maxZoom: config.zoom_range[1]
		})
	});
	map.on('moveend', updatePermalink);
	window.addEventListener('popstate', popState);
	
	initMeasurements(map, measurement_layers, popupsEnabled);
	
	var layerSwitcher = new ol.control.LayerSwitcher();
	map.addControl(layerSwitcher);
	
	$.getJSON('vector_layers.json', addVectorLayers);
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

	addVillageLayer();

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

function addPopupActions(map, layer_data) {
	// Highlight element on hover:
	var hoverAction = new ol.interaction.Select({
		condition: ol.events.condition.pointerMove,
		filter: function(feature, layer) {
			if (layer === null) {
				return false;
			}
			if (layer.getProperties()['title'] == 'Villages') {
				return true;
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
			if (layer.getProperties()['title'] == 'Villages') {
				return true;
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
			if(!props['layer'] && !props['pagename']) {
				return;
			}
			var html = "<img src='img/loading.gif' alt='loading' class='loading'>";
			content.html(html);
			container.css("right", "0");
			otherElementsThatHaveToBeMovedToTheLeft.css("right", "407px");

			if (props['entityhandle']) {
				query = "Handle::0x" + props['entityhandle'];
			} else if (props['pagename']) {
				query = props['pagename'];
			}
			$.ajax({
				url: wikiApi + "?action=askargs&printouts=Summary&format=json&conditions=" + query,
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

var styleCache;

function addVillageLayer() {
	styleCache = {};
	var vectorSource = new ol.source.Vector({
		url: 'vector/villages.json',
		format: new ol.format.GeoJSON()
	});
	
	var vectorLayer = new ol.layer.Vector({
		title: 'Villages',
		source: vectorSource,
		visible: true,
		style: function(feature, resolution) {
			props = feature.getProperties();
			if (styleCache[props['image_url']]) {
				return [styleCache[props['image_url']]];
			}
			if (props['image_url']) {
				img = new ol.style.Icon({
					src: props['image_url'],
					size: [32, 32]
				});

			} else {
				img = new ol.style.Circle({
					radius: 6,
					fill: new ol.style.Fill({
						color: 'red'
					})
				});
			}

			style = new ol.style.Style({image: img});
			styleCache[props['image_url']] = style;
			return [style];
		},
		updateWhileAnimating: !isMobile(),
		updateWhileInteracting: !isMobile()
	});
	vectorLayer.setZIndex(10);
	overlay_layers.getLayers().push(vectorLayer);
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
	$(".mw-body img").each(function() {
		url = $(this).attr('src');
		if(url.substr(0, 1) == "/") {
			url = wikiUrl + url.substr(1);
			$(this).attr('src', url);
		}
	});

	// Tweak the padding on the tagcloud container to cram it in.
	// Can't do this in CSS as the container has no class or ID.
	$(".srf-tagcloud").each(function() {
		$(this).parent().css('padding', '0');
	});
	createSHAFlag();
}
