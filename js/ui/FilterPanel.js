// ============================================================================
// FILTER PANEL - Unified filter UI components
// Works for both Map View and Graph View
// ============================================================================

const FilterPanel = {
    // Current filter state
    state: {
        selectedRegions: [],
        selectedViolenceType: null,
        selectedRelationshipType: 'all' // For Graph View
    },

    // Callback references
    callbacks: {
        onRegionToggle: null,
        onViolenceTypeChange: null,
        onRelationshipTypeChange: null
    },

    // ========================================================================
    // REGION LEGEND / FILTER
    // ========================================================================

    /**
     * Create region legend with toggle functionality
     * @param {string} containerSelector - CSS selector for legend container
     * @param {Array} regions - Array of region names (optional, uses REGION_COLORS keys if not provided)
     * @param {Function} onToggle - Callback when region is toggled
     */
    createLegend(containerSelector, regions = null, onToggle = null) {
        const container = d3.select(containerSelector);
        if (container.empty()) return;

        container.html('');

        const regionList = regions || Object.keys(REGION_COLORS);
        this.callbacks.onRegionToggle = onToggle;

        // Initialize all regions as selected
        this.state.selectedRegions = [...regionList];

        regionList.forEach(region => {
            const item = container.append("div")
                .attr("class", "legend-item active")
                .attr("data-region", region)
                .style("cursor", "pointer")
                .on("click", () => this._handleRegionToggle(region));

            item.append("div")
                .attr("class", "legend-color")
                .style("background", REGION_COLORS[region] || "#64748b");

            item.append("span")
                .text(region);
        });
    },

    /**
     * Handle region toggle
     * @private
     */
    _handleRegionToggle(region) {
        const index = this.state.selectedRegions.indexOf(region);

        if (index > -1) {
            // Deselect
            this.state.selectedRegions.splice(index, 1);
            d3.select(`[data-region="${region}"]`).classed("active", false);
        } else {
            // Select
            this.state.selectedRegions.push(region);
            d3.select(`[data-region="${region}"]`).classed("active", true);
        }

        if (this.callbacks.onRegionToggle) {
            this.callbacks.onRegionToggle(region, this.state.selectedRegions);
        }
    },

    // ========================================================================
    // VIOLENCE TYPE FILTER
    // ========================================================================

    /**
     * Create violence type filter
     * @param {string} containerSelector - CSS selector for filter container
     * @param {Function} onChange - Callback when filter changes
     */
    createViolenceTypeFilter(containerSelector, onChange = null) {
        const container = d3.select(containerSelector);
        if (container.empty()) return;

        container.html('');
        this.callbacks.onViolenceTypeChange = onChange;

        // All types option
        const allItem = container.append("div")
            .attr("class", "legend-item active")
            .attr("data-violence-type", "all")
            .style("cursor", "pointer")
            .on("click", () => this._handleViolenceTypeChange(null));

        allItem.append("div")
            .attr("class", "legend-color")
            .style("background", "linear-gradient(90deg, #d9534f 33%, #f0ad4e 33% 66%, #0275d8 66%)");

        allItem.append("span")
            .text("All Types");

        // Individual types
        Object.entries(TYPE_MAP).forEach(([code, name]) => {
            const item = container.append("div")
                .attr("class", "legend-item")
                .attr("data-violence-type", name)
                .style("cursor", "pointer")
                .on("click", () => this._handleViolenceTypeChange(name));

            item.append("div")
                .attr("class", "legend-color")
                .style("background", TYPE_COLORS[name] || "#64748b");

            item.append("span")
                .text(name);
        });
    },

    /**
     * Handle violence type change
     * @private
     */
    _handleViolenceTypeChange(type) {
        this.state.selectedViolenceType = type;

        // Update UI
        d3.selectAll("[data-violence-type]").classed("active", false);

        if (type === null) {
            d3.select('[data-violence-type="all"]').classed("active", true);
        } else {
            d3.select(`[data-violence-type="${type}"]`).classed("active", true);
        }

        if (this.callbacks.onViolenceTypeChange) {
            this.callbacks.onViolenceTypeChange(type);
        }
    },

    /**
     * Get current violence type filter
     * @returns {string|null}
     */
    getSelectedViolenceType() {
        return this.state.selectedViolenceType;
    },

    // ========================================================================
    // RELATIONSHIP TYPE FILTER (Graph View Only)
    // ========================================================================

    /**
     * Create relationship type filter for Graph View
     * @param {string} containerSelector - CSS selector for filter container
     * @param {Function} onChange - Callback when filter changes
     */
    createRelationshipFilter(containerSelector, onChange = null) {
        const container = d3.select(containerSelector);
        if (container.empty()) return;

        // Don't recreate if already exists with proper handlers
        if (container.selectAll("[data-filter]").size() > 0) {
            // Just add click handlers
            this._attachRelationshipHandlers(container, onChange);
            return;
        }

        this.callbacks.onRelationshipTypeChange = onChange;

        // Relationship types are usually defined in HTML for Graph View
        // This sets up the handlers
        this._attachRelationshipHandlers(container, onChange);
    },

    /**
     * Attach handlers to existing relationship filter items
     * @private
     */
    _attachRelationshipHandlers(container, onChange) {
        this.callbacks.onRelationshipTypeChange = onChange;

        container.selectAll("[data-filter]").each(function () {
            const item = d3.select(this);
            const filterType = item.attr("data-filter");

            item.style("cursor", "pointer")
                .on("click", () => {
                    FilterPanel._handleRelationshipTypeChange(filterType);
                });
        });
    },

    /**
     * Handle relationship type change
     * @private
     */
    _handleRelationshipTypeChange(type) {
        this.state.selectedRelationshipType = type;

        // Update UI
        d3.selectAll("[data-filter]").classed("active", false);
        d3.select(`[data-filter="${type}"]`).classed("active", true);

        if (this.callbacks.onRelationshipTypeChange) {
            this.callbacks.onRelationshipTypeChange(type);
        }
    },

    /**
     * Get current relationship type filter
     * @returns {string}
     */
    getSelectedRelationshipType() {
        return this.state.selectedRelationshipType;
    },

    // ========================================================================
    // LEFT PANEL CONTENT UPDATE
    // ========================================================================

    /**
     * Update left panel content based on view context
     * @param {Object} config - Panel configuration
     * @param {string} config.viewType - 'world', 'region', 'country', 'faction', 'factionMap'
     * @param {Object} config.data - View-specific data
     * @param {Object} config.callbacks - Event callbacks
     */
    updateLeftPanel(config) {
        const { viewType, data, callbacks } = config;

        switch (viewType) {
            case 'world':
                this._renderWorldPanel(data, callbacks);
                break;
            case 'region':
                this._renderRegionPanel(data, callbacks);
                break;
            case 'country':
                this._renderCountryPanel(data, callbacks);
                break;
            case 'faction':
                this._renderFactionPanel(data, callbacks);
                break;
            case 'factionMap':
                this._renderFactionMapPanel(data, callbacks);
                break;
            default:
                console.warn('FilterPanel: Unknown view type:', viewType);
        }
    },

    /**
     * Render world view panel
     * @private
     */
    _renderWorldPanel(data, callbacks) {
        // World view shows overview statistics and legend
        // This is typically handled by the main view, but we can provide helper
        d3.select("#charts-title").text("Overview Statistics");
        d3.select("#charts-subtitle").text("Global Conflict Data");
    },

    /**
     * Render region view panel
     * @private
     */
    _renderRegionPanel(data, callbacks) {
        d3.select("#charts-title").text(`${data.regionName} Statistics`);
        d3.select("#charts-subtitle").text("Regional Analysis");
    },

    /**
     * Render country view panel
     * @private
     */
    _renderCountryPanel(data, callbacks) {
        d3.select("#charts-title").text(`${data.countryName} Statistics`);
        d3.select("#charts-subtitle").text(`${data.region || 'Unknown Region'}`);
    },

    /**
     * Render faction view panel (Graph View focused faction)
     * @private
     */
    _renderFactionPanel(data, callbacks) {
        d3.select("#charts-title").text("Faction Statistics");
        d3.select("#charts-subtitle").text(data.factionName || "Unknown Faction");
    },

    /**
     * Render faction map view panel
     * @private
     */
    _renderFactionMapPanel(data, callbacks) {
        d3.select("#charts-title").text("Faction Map View");
        d3.select("#charts-subtitle").text(data.factionName || "Unknown Faction");
    },

    // ========================================================================
    // RESET
    // ========================================================================

    /**
     * Reset all filters to default state
     */
    reset() {
        this.state.selectedRegions = Object.keys(REGION_COLORS);
        this.state.selectedViolenceType = null;
        this.state.selectedRelationshipType = 'all';

        // Update UI
        d3.selectAll(".legend-item").classed("active", true);
        d3.selectAll("[data-violence-type]").classed("active", false);
        d3.select('[data-violence-type="all"]').classed("active", true);
        d3.selectAll("[data-filter]").classed("active", false);
        d3.select('[data-filter="all"]').classed("active", true);
    },

    /**
     * Get current filter state
     * @returns {Object}
     */
    getState() {
        return { ...this.state };
    }
};
