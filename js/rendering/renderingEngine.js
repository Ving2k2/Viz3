// ============================================================================
// RENDERING ENGINE - Shared map rendering functions
// ============================================================================

class RenderingEngine {
    constructor() {
        this.worldMapFeatures = null;
        this.projection = null;
        this.path = null;
    }

    /**
     * Initialize projection and path
     */
    initialize(mapWidth, mapHeight) {
        this.projection = d3.geoEquirectangular()
            .scale(mapWidth / 6.5)
            .translate([mapWidth / 2, mapHeight / 2]);

        this.path = d3.geoPath().projection(this.projection);

        return { projection: this.projection, path: this.path };
    }

    /**
     * Load and draw world map
     */
    async drawWorldMap(mapGroup, handleCountryClick) {
        try {
            const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
            const countries = topojson.feature(world, world.objects.countries);
            this.worldMapFeatures = countries.features;

            mapGroup.selectAll("*").remove();

            mapGroup.append("path")
                .datum({ type: "Sphere" })
                .attr("class", "sphere")
                .attr("d", this.path);

            const graticule = d3.geoGraticule();
            mapGroup.append("path")
                .datum(graticule)
                .attr("class", "graticule")
                .attr("d", this.path);

            mapGroup.selectAll(".country")
                .data(countries.features)
                .join("path")
                .attr("class", "country")
                .attr("d", this.path)
                .style("cursor", "pointer")
                .on("click", handleCountryClick);

        } catch (error) {
            console.error("❌ Error loading world map:", error);
        }
    }

    /**
     * Draw conflict bubbles (aggregated by country) with premium styling
     */
    drawConflictBubbles(bubblesGroup, countries, zoomScale, handleBubbleClick) {
        const self = this;
        const maxCasualties = d3.max(countries, d => d.totalCasualties);
        const baseRange = [6 / zoomScale, 45 / zoomScale];

        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range(baseRange);

        const bubbles = bubblesGroup.selectAll(".conflict-bubble")
            .data(countries, d => d.name);

        bubbles.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .style("fill-opacity", 0)
            .remove();

        const enter = bubbles.enter()
            .append("circle")
            .attr("class", "conflict-bubble")
            .attr("cx", d => this.projection(d.coordinates)[0])
            .attr("cy", d => this.projection(d.coordinates)[1])
            .attr("r", 0)
            // Premium styling - no stroke per user request
            .style("fill", d => REGION_COLORS[d.region])
            .style("fill-opacity", 0.75)
            .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.2))")
            .style("cursor", "pointer")
            // Tooltip handlers
            .on("mouseover", (event, d) => self.showCountryTooltip(event, d))
            .on("mouseout", () => self.hideCountryTooltip())
            .on("click", handleBubbleClick);

        enter.transition()
            .duration(500)
            .attr("r", d => radiusScale(d.totalCasualties))
            .style("fill-opacity", 0.75);

        bubbles
            .transition()
            .duration(200)
            .attr("r", d => radiusScale(d.totalCasualties))
            .style("fill-opacity", 0.75);
    }

    /**
     * Update bubble sizes on zoom (for world view)
     */
    updateBubbleSizes(bubblesGroup, countries, zoomScale) {
        const maxCasualties = d3.max(countries, d => d.totalCasualties);
        const baseRange = [5 / zoomScale, 40 / zoomScale];

        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range(baseRange);

        bubblesGroup.selectAll(".conflict-bubble")
            .transition()
            .duration(100)
            .attr("r", d => radiusScale(d.totalCasualties));
    }

    /**
     * Draw individual event bubbles (for country view)
     * Styling unified with conflict bubbles for consistency
     */
    drawIndividualEventBubbles(bubblesGroup, events, zoomScale, selectedEvent, handlers) {
        const maxCasualties = d3.max(events, d => d.best);
        const baseRange = [3 / zoomScale, 20 / zoomScale];

        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range(baseRange);

        const eventBubbles = bubblesGroup.selectAll(".event-bubble")
            .data(events, (d, i) => `${d.country}-${d.year}-${i}`);

        // Exit with animation - unified with conflict bubbles
        eventBubbles.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .style("fill-opacity", 0)
            .remove();

        const enter = eventBubbles.enter()
            .append("circle")
            .attr("class", "event-bubble")
            .attr("cx", d => this.projection([d.longitude, d.latitude])[0])
            .attr("cy", d => this.projection([d.longitude, d.latitude])[1])
            .attr("r", 0)
            // Premium styling - no stroke per user request
            .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
            .style("fill-opacity", 0.75)
            .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.15))")
            .style("cursor", "pointer")
            .classed("selected-event", d => selectedEvent && d === selectedEvent)
            .classed("unselected-event", d => selectedEvent && d !== selectedEvent)
            .on("mouseover", handlers.showTooltip)
            .on("mouseout", handlers.hideTooltip)
            .on("click", (event, d) => {
                event.stopPropagation();
                handlers.selectEvent(d);
            });

        // Animate bubbles in
        enter.transition()
            .duration(500)
            .attr("r", d => radiusScale(d.best))
            .style("fill-opacity", 0.75);

        // Update existing bubbles
        eventBubbles
            .attr("cx", d => this.projection([d.longitude, d.latitude])[0])
            .attr("cy", d => this.projection([d.longitude, d.latitude])[1])
            .transition()
            .duration(200)
            .attr("r", d => radiusScale(d.best))
            .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
            .style("fill-opacity", d => {
                if (selectedEvent) {
                    return d === selectedEvent ? 1 : 0.3;
                }
                return 0.75;
            });
    }

    /**
     * Show event tooltip
     */
    showEventTooltip(event, d) {
        const tooltip = d3.select("body").append("div")
            .attr("class", "event-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)")
            .style("color", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "8px")
            .style("font-size", "0.875rem")
            .style("pointer-events", "none")
            .style("z-index", "10000")
            .html(`
                <strong>${d.dyad_name || 'Unknown Event'}</strong><br>
                <span style="color: #94a3b8;">${d.date_start || d.year}</span><br>
                <span style="color: ${TYPE_COLORS[d.type_of_violence_name]};">${d.type_of_violence_name}</span><br>
                <strong style="color: #ef4444;">${d3.format(",d")(d.best)} casualties</strong><br>
                ${d.where_description ? `📍 ${d.where_description}` : ''}
            `);

        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
    }

    /**
     * Hide event tooltip
     */
    hideEventTooltip() {
        d3.selectAll(".event-tooltip").remove();
    }

    /**
     * Show country tooltip (for aggregated country bubbles)
     */
    showCountryTooltip(event, d) {
        const tooltip = d3.select("body").append("div")
            .attr("class", "country-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)")
            .style("color", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "8px")
            .style("font-size", "0.875rem")
            .style("pointer-events", "none")
            .style("z-index", "10000")
            .style("border-left", `4px solid ${REGION_COLORS[d.region]}`)
            .html(`
                <strong>${d.name || d.country}</strong><br>
                <span style="color: ${REGION_COLORS[d.region]};">${d.region}</span><br>
                <strong style="color: #ef4444;">${d3.format(",d")(d.totalCasualties || d.casualties || 0)} casualties</strong><br>
                <span style="color: #94a3b8;">${d3.format(",d")(d.eventCount || d.events?.length || 0)} events</span>
            `);

        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
    }

    /**
     * Hide country tooltip
     */
    hideCountryTooltip() {
        d3.selectAll(".country-tooltip").remove();
    }

    /**
     * Find country feature using comprehensive matching
     */
    findCountryFeature(countryName) {
        if (!this.worldMapFeatures) return null;

        const mapCountryNames = this.worldMapFeatures.map(f => f.properties.name);

        // Direct match
        let feature = this.worldMapFeatures.find(f => f.properties.name === countryName);
        if (feature) return feature;

        // Manual mapping (from COUNTRY_NAME_MAPPING in shared.js)
        const mappedName = getMapCountryName(countryName, mapCountryNames);
        if (mappedName) {
            feature = this.worldMapFeatures.find(f => f.properties.name === mappedName);
            if (feature) return feature;
        }

        return null;
    }

    /**
     * Get neighboring countries
     */
    getNeighboringCountries(countryName) {
        if (!this.worldMapFeatures) return [];

        const targetCountry = this.worldMapFeatures.find(f => f.properties.name === countryName);
        if (!targetCountry) return [];

        const neighbors = [];
        const targetBounds = this.path.bounds(targetCountry);

        this.worldMapFeatures.forEach(feature => {
            if (feature.properties.name === countryName) return;

            const featureBounds = this.path.bounds(feature);

            const xOverlap = !(featureBounds[1][0] < targetBounds[0][0] - 50 || featureBounds[0][0] > targetBounds[1][0] + 50);
            const yOverlap = !(featureBounds[1][1] < targetBounds[0][1] - 50 || featureBounds[0][1] > targetBounds[1][1] + 50);

            if (xOverlap && yOverlap) {
                neighbors.push(feature.properties.name);
            }
        });

        return neighbors;
    }

    /**
     * Get projection
     */
    getProjection() {
        return this.projection;
    }

    /**
     * Get path
     */
    getPath() {
        return this.path;
    }

    /**
     * Get world map features
     */
    getWorldMapFeatures() {
        return this.worldMapFeatures;
    }
}

// Export singleton instance
const renderingEngine = new RenderingEngine();
