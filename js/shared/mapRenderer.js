// ============================================================================
// MAP RENDERER - World map and bubble rendering
// ============================================================================

class RenderingEngine {
    constructor() {
        this.worldMapFeatures = null;
        this.projection = null;
        this.path = null;
    }

    /**
     * Initialize projection and path
     * @param {number} mapWidth - Map width
     * @param {number} mapHeight - Map height
     * @returns {Object} {projection, path}
     */
    initialize(mapWidth, mapHeight) {
        this.projection = d3.geoNaturalEarth1()
            .scale(mapWidth / 5.5)
            .translate([mapWidth / 2, mapHeight / 2]);

        this.path = d3.geoPath().projection(this.projection);

        return {
            projection: this.projection,
            path: this.path
        };
    }

    /**
     * Load and draw world map
     * @param {d3.Selection} mapGroup - D3 selection for map group
     * @param {Function} handleCountryClick - Click handler
     */
    async drawWorldMap(mapGroup, handleCountryClick) {
        try {
            const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
            const countries = topojson.feature(world, world.objects.countries);
            this.worldMapFeatures = countries.features;

            mapGroup.selectAll("*").remove();

            // Draw sphere (ocean background)
            mapGroup.append("path")
                .datum({ type: "Sphere" })
                .attr("class", "sphere")
                .attr("d", this.path);

            // Draw graticule (grid lines)
            const graticule = d3.geoGraticule();
            mapGroup.append("path")
                .datum(graticule)
                .attr("class", "graticule")
                .attr("d", this.path);

            // Draw countries
            mapGroup.selectAll(".country")
                .data(countries.features)
                .join("path")
                .attr("class", "country")
                .attr("d", this.path)
                .style("cursor", "pointer")
                .on("click", handleCountryClick);

            return this.worldMapFeatures;
        } catch (error) {
            console.error("❌ Error loading world map:", error);
            throw error;
        }
    }

    /**
     * Draw conflict bubbles (aggregated by country)
     * @param {d3.Selection} bubblesGroup - D3 selection for bubbles
     * @param {Array} countries - Country data array
     * @param {number} zoomScale - Current zoom scale
     * @param {Function} handleBubbleClick - Click handler
     */
    drawConflictBubbles(bubblesGroup, countries, zoomScale, handleBubbleClick) {
        const maxCasualties = d3.max(countries, d => d.totalCasualties);
        const zoomFactor = zoomScale || 1;
        const baseRange = [5 / zoomFactor, 40 / zoomFactor];

        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range(baseRange);

        const bubbles = bubblesGroup.selectAll(".conflict-bubble")
            .data(countries, d => d.name);

        // Exit
        bubbles.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .style("opacity", 0)
            .remove();

        // Enter
        const enter = bubbles.enter()
            .append("circle")
            .attr("class", "conflict-bubble")
            .attr("cx", d => this.projection(d.coordinates)[0])
            .attr("cy", d => this.projection(d.coordinates)[1])
            .attr("r", 0)
            .style("fill", d => REGION_COLORS[d.region] || "#64748b")
            .style("cursor", "pointer")
            .style("opacity", 0)
            .on("click", handleBubbleClick);

        enter.transition()
            .duration(500)
            .attr("r", d => radiusScale(d.totalCasualties))
            .style("opacity", 0.8);

        // Update
        bubbles
            .transition()
            .duration(200)
            .attr("r", d => radiusScale(d.totalCasualties))
            .style("opacity", 0.8);
    }

    /**
     * Update bubble sizes on zoom
     * @param {d3.Selection} bubblesGroup - D3 selection for bubbles
     * @param {Array} countries - Country data array
     * @param {number} zoomScale - Current zoom scale
     */
    updateBubbleSizes(bubblesGroup, countries, zoomScale) {
        const maxCasualties = d3.max(countries, d => d.totalCasualties);
        const zoomFactor = zoomScale || 1;
        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range([5 / zoomFactor, 40 / zoomFactor]);

        bubblesGroup.selectAll(".conflict-bubble")
            .transition()
            .duration(100)
            .attr("r", d => radiusScale(d.totalCasualties));
    }

    /**
     * Draw individual event bubbles
     * @param {d3.Selection} bubblesGroup - D3 selection for bubbles
     * @param {Array} events - Event data array
     * @param {number} zoomScale - Current zoom scale
     * @param {Object} selectedEvent - Currently selected event
     * @param {Object} handlers - {onClick, onMouseover, onMouseout}
     */
    drawIndividualEventBubbles(bubblesGroup, events, zoomScale, selectedEvent, handlers = {}) {
        const maxCasualties = d3.max(events, e => e.best) || 1;
        const zoomFactor = zoomScale || 1;
        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range([3 / zoomFactor, 20 / zoomFactor]);

        const bubbles = bubblesGroup.selectAll(".event-bubble")
            .data(events, d => d.id || `${d.country}-${d.year}-${d.latitude}-${d.longitude}`)
            .join(
                enter => enter.append("circle")
                    .attr("class", "event-bubble")
                    .attr("cx", d => this.projection([d.longitude, d.latitude])[0])
                    .attr("cy", d => this.projection([d.longitude, d.latitude])[1])
                    .attr("r", 0)
                    .style("fill", d => TYPE_COLORS[d.type_of_violence_name] || "#64748b")
                    .style("cursor", "pointer")
                    .style("opacity", 0)
                    .classed("selected-event", d => selectedEvent && d === selectedEvent)
                    .classed("unselected-event", d => selectedEvent && d !== selectedEvent)
                    .on("click", handlers.onClick || (() => { }))
                    .on("mouseover", handlers.onMouseover || (() => { }))
                    .on("mouseout", handlers.onMouseout || (() => { })),
                update => update,
                exit => exit.remove()
            );

        bubbles.transition()
            .duration(800)
            .attr("r", d => radiusScale(d.best))
            .style("opacity", 0.7);

        return bubbles;
    }

    /**
     * Find country feature using comprehensive matching
     * @param {string} countryName - Country name to find
     * @returns {Object|null} Country feature or null
     */
    findCountryFeature(countryName) {
        if (!this.worldMapFeatures) return null;

        // Try exact match
        let feature = this.worldMapFeatures.find(f => f.properties.name === countryName);
        if (feature) return feature;

        // Try mapping
        const mappedName = COUNTRY_NAME_MAPPING[countryName];
        if (mappedName) {
            feature = this.worldMapFeatures.find(f => f.properties.name === mappedName);
            if (feature) return feature;
        }

        // Try normalized match
        const normalized = normalizeCountryName(countryName);
        feature = this.worldMapFeatures.find(f =>
            normalizeCountryName(f.properties.name) === normalized
        );

        return feature || null;
    }

    /**
     * Zoom to specific country
     * @param {d3.Selection} svg - SVG selection
     * @param {d3.ZoomBehavior} zoom - D3 zoom behavior
     * @param {Object} countryFeature - Country GeoJSON feature
     * @param {number} mapWidth - Map width
     * @param {number} mapHeight - Map height
     */
    zoomToCountry(svg, zoom, countryFeature, mapWidth, mapHeight) {
        const bounds = this.path.bounds(countryFeature);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / mapWidth, dy / mapHeight)));
        const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

        svg.transition()
            .duration(750)
            .call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
    }

    /**
     * Reset zoom to world view
     * @param {d3.Selection} svg - SVG selection
     * @param {d3.ZoomBehavior} zoom - D3 zoom behavior
     */
    resetZoom(svg, zoom) {
        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity);
    }

    getProjection() { return this.projection; }
    getPath() { return this.path; }
    getWorldMapFeatures() { return this.worldMapFeatures; }
}

// Export singleton instance
const renderingEngine = new RenderingEngine();
