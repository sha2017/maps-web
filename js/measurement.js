var drawings = [];
var tooltips = [];
var source;
function removeDrawing(counter) {
	source.removeFeature(drawings[counter]);
	tooltips[counter].parentNode.removeChild(tooltips[counter]);
	
	source.refresh({force:true});
}

function initMeasurements(map, layergroup, popupsEnabled)
{
	var wgs84Sphere = new ol.Sphere(6378137);
	
	source = new ol.source.Vector();
	var vector = new ol.layer.Vector({
		source: source,
		style: new ol.style.Style({
			fill: new ol.style.Fill({
				color: 'rgba(255, 255, 255, 0.2)'
			}),
			stroke: new ol.style.Stroke({
				color: '#ffcc33',
				width: 2
			}),
			image: new ol.style.Circle({
				radius: 7,
				fill: new ol.style.Fill({
					color: '#ffcc33'
				})
			})
		})
	});
	layergroup.getLayers().push(vector);
	
	
	/**
	 * Currently drawn feature.
	 * @type {ol.Feature}
	 */
	var sketch;
	
	
	/**
	 * The help tooltip element.
	 * @type {Element}
	 */
	var helpTooltipElement;
	
	
	/**
	 * Overlay to show the help messages.
	 * @type {ol.Overlay}
	 */
	var helpTooltip;
	
	
	/**
	 * The measure tooltip element.
	 * @type {Element}
	 */
	var measureTooltipElement;
	
	
	/**
	 * Overlay to show the measurement.
	 * @type {ol.Overlay}
	 */
	var measureTooltip;
	
	
	/**
	 * Handle pointer move.
	 * @param {ol.MapBrowserEvent} evt
	 */
	var pointerMoveHandler = function (evt) {
		if (evt.dragging) {
			return;
		}
		/** @type {string} */
		var helpMsg = 'Click to start drawing';
		/** @type {ol.Coordinate|undefined} */
		var tooltipCoord = evt.coordinate;
		
		if (sketch) {
			var output;
			var geom = (sketch.getGeometry());
			if (geom instanceof ol.geom.Polygon) {
				output = formatArea(/** @type {ol.geom.Polygon} */ (geom));
				helpMsg = 'Double-click to finish drawing the polygon';
				tooltipCoord = geom.getInteriorPoint().getCoordinates();
			} else if (geom instanceof ol.geom.LineString) {
				output = formatLength(/** @type {ol.geom.LineString} */ (geom));
				helpMsg = 'Double-click to finish drawing the line';
				tooltipCoord = geom.getLastCoordinate();
			}
			measureTooltipElement.innerHTML = output;
			measureTooltip.setPosition(tooltipCoord);
		}
		
		helpTooltipElement.innerHTML = helpMsg;
		helpTooltip.setPosition(evt.coordinate);
	};
	
	
	
	
	var typeSelect = document.getElementById('measurement-type');
	var aanuitknop = document.getElementById('measurement-enable');
	var widget = document.getElementById('measurement-tool');
	
	var draw; // global so we can remove it later
	var drawingCounter = 0;
	function addInteraction() {
		var type = (typeSelect.value == 'area' ? 'Polygon' : 'LineString');
		draw = new ol.interaction.Draw({
			source: source,
			type: /** @type {ol.geom.GeometryType} */ (type),
			style: new ol.style.Style({
				fill: new ol.style.Fill({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new ol.style.Stroke({
					color: 'rgba(0, 0, 0, 0.5)',
					lineDash: [10, 10],
					width: 2
				}),
				image: new ol.style.Circle({
					radius: 5,
					stroke: new ol.style.Stroke({
						color: 'rgba(0, 0, 0, 0.7)'
					}),
					fill: new ol.style.Fill({
						color: 'rgba(255, 255, 255, 0.2)'
					})
				})
			})
		});
		map.addInteraction(draw);
		
		createMeasureTooltip();
		createHelpTooltip();
		
		draw.on('drawstart',
			function (evt) {
				// set sketch
				sketch = evt.feature;
			}, this);
		
		draw.on('drawend',
			function (evt) {
				drawings[drawingCounter] = sketch;
				tooltips[drawingCounter] = measureTooltipElement;
				measureTooltipElement.className = 'tooltip tooltip-static';
				measureTooltipElement.innerHTML += ' <a onclick="removeDrawing(' + drawingCounter + ')">&times;</a>';
				drawingCounter++;
				
				measureTooltip.setOffset([0, -7]);
				// unset sketch
				sketch = null;
				// unset tooltip so that a new one can be created
				measureTooltipElement = null;
				createMeasureTooltip();
			}, this);
	}
	
	/**
	 * Creates a new help tooltip
	 */
	function createHelpTooltip() {
		if (helpTooltipElement) {
			helpTooltipElement.parentNode.removeChild(helpTooltipElement);
		}
		helpTooltipElement = document.createElement('div');
		helpTooltipElement.className = 'tooltip';
		helpTooltip = new ol.Overlay({
			element: helpTooltipElement,
			offset: [15, 0],
			positioning: 'center-left'
		});
		map.addOverlay(helpTooltip);
	}
	
	function removeHelpTooltip() {
		if (helpTooltipElement) {
			helpTooltipElement.parentNode.removeChild(helpTooltipElement);
		}
		helpTooltipElement = null;
	}
	
	
	/**
	 * Creates a new measure tooltip
	 */
	function createMeasureTooltip() {
		if (measureTooltipElement) {
			measureTooltipElement.parentNode.removeChild(measureTooltipElement);
		}
		measureTooltipElement = document.createElement('div');
		measureTooltipElement.className = 'tooltip tooltip-measure';
		measureTooltip = new ol.Overlay({
			element: measureTooltipElement,
			offset: [0, -15],
			positioning: 'bottom-center'
		});
		map.addOverlay(measureTooltip);
	}
	
	
	
	
	/**
	 * format length output
	 * @param {ol.geom.LineString} line
	 * @return {string}
	 */
	var formatLength = function (line) {
		var coordinates = line.getCoordinates();
		var length = 0;
		var sourceProj = map.getView().getProjection();
		for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
			var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:4326');
			var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
			length += wgs84Sphere.haversineDistance(c1, c2);
		}
		var output;
		if (length > 100) {
			output = (Math.round(length / 1000 * 100) / 100) +
				' ' + 'km';
		} else {
			output = (Math.round(length * 100) / 100) +
				' ' + 'm';
		}
		return output;
	};
	
	
	/**
	 * format length output
	 * @param {ol.geom.Polygon} polygon
	 * @return {string}
	 */
	var formatArea = function (polygon) {
		var sourceProj = map.getView().getProjection();
		var geom = /** @type {ol.geom.Polygon} */(polygon.clone().transform(
			sourceProj, 'EPSG:4326'));
		var coordinates = geom.getLinearRing(0).getCoordinates();
		var area = Math.abs(wgs84Sphere.geodesicArea(coordinates));
		var output;
		if (area > 10000) {
			output = (Math.round(area / 1000000 * 100) / 100) +
				' ' + 'km<sup>2</sup>';
		} else {
			output = (Math.round(area * 100) / 100) +
				' ' + 'm<sup>2</sup>';
		}
		return output;
	};
	
	var pointerMoveEvent;
	
	function start() {
		addInteraction();
		pointerMoveEvent = map.on('pointermove', pointerMoveHandler);
		popupsEnabled.enabled = false;
		
		typeSelect.onchange = function (e) {
			map.removeInteraction(draw);
			addInteraction();
		};
	}
	
	function stop() {
		map.removeInteraction(draw);
		map.unByKey(pointerMoveEvent);
		removeHelpTooltip();
		popupsEnabled.enabled = true;
		
		typeSelect.onchange = function (e) {};
	}
	
	function setActivationState() {
		if(aanuitknop.checked) {
			start();
		} else {
			stop();
		}
	}
	
	aanuitknop.onchange = setActivationState;
	
	setActivationState();
	
	var hiddenClasses = "ol-control";
	var shownClasses = hiddenClasses + " shown";
	
	widget.onmouseover = function() {
		widget.className = shownClasses;
	};
	widget.onmouseout = function() {
		widget.className = hiddenClasses;
	};
}
