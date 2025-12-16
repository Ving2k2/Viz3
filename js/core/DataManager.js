// ============================================================================
// DATA MANAGER - Centralized data loading, filtering, and aggregation
// Extends dataFilterManager with chart-specific aggregation methods
// ============================================================================

class DataManager {
    constructor() {
        this.rawData = null;
        this.processedData = null;
        this.countryDataMap = new Map();
        this.isInitialized = false;
    }

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    /**
     * Load CSV data and initialize all managers
     * @param {string} csvPath - Path to CSV file
     * @returns {Promise<Array>} Processed data array
     */
    async loadData(csvPath = 'GEDEvent_v25_1.csv') {
        console.log('📊 DataManager: Loading data...');

        try {
            const data = await d3.csv(csvPath);
            console.log(`📊 DataManager: Loaded ${data.length} raw records`);

            // Process raw data using shared.js function
            this.rawData = processRawData(data);
            console.log(`📊 DataManager: Processed ${this.rawData.length} valid events`);

            // Initialize dataFilterManager with processed data
            if (typeof dataFilterManager !== 'undefined') {
                dataFilterManager.initialize(this.rawData);
                console.log('📊 DataManager: Initialized dataFilterManager');
            }

            // Aggregate by country
            this.processedData = aggregateByCountry(this.rawData, this.countryDataMap);
            console.log(`📊 DataManager: Aggregated ${this.processedData.length} countries`);

            this.isInitialized = true;
            return this.rawData;

        } catch (error) {
            console.error('❌ DataManager: Error loading data:', error);
            throw error;
        }
    }

    // ========================================================================
    // FILTER FUNNEL - UNIFIED CONTEXT-BASED FILTERING
    // ========================================================================

    /**
     * Get events by context type - UNIFIED FILTER FUNNEL
     * Both Map View (Country) and Graph View (Faction) use this single method.
     * 
     * @param {string} contextType - 'COUNTRY' | 'FACTION' | 'GLOBAL'
     * @param {string|null} id - Country name or Faction ID
     * @param {Object} options - Additional filters {year, violenceType}
     * @returns {Array} Normalized events with uniform structure
     */
    getEventsByContext(contextType, id = null, options = {}) {
        if (!this.isInitialized) {
            console.warn('DataManager not initialized');
            return [];
        }

        const { year = null, violenceType = null } = options;
        let events = [];

        // FILTER based on context type (the "Funnel")
        switch (contextType) {
            case 'COUNTRY':
                events = this._getCountryEvents(id);
                break;
            case 'FACTION':
                events = this._getFactionEvents(id);
                break;
            case 'GLOBAL':
            default:
                events = this.rawData || [];
        }

        // Apply optional time/type filters
        if (year !== null) {
            events = events.filter(e => e.year <= year);
        }
        if (violenceType !== null) {
            events = events.filter(e => e.type_of_violence === violenceType || e.type_of_violence_name === violenceType);
        }

        // NORMALIZE output structure (ensures Charts don't break)
        return this._normalizeEvents(events, contextType);
    }

    /**
     * Get events for a specific country
     * @private
     */
    _getCountryEvents(countryName) {
        if (typeof dataFilterManager !== 'undefined') {
            return dataFilterManager.getCountryEvents(countryName);
        }
        return (this.rawData || []).filter(d => d.country === countryName);
    }

    /**
     * Get events for a specific faction
     * @private
     */
    _getFactionEvents(factionId) {
        if (typeof dataFilterManager !== 'undefined') {
            return dataFilterManager.getFactionEvents(factionId);
        }
        return (this.rawData || []).filter(d =>
            d.side_a === factionId || d.side_b === factionId ||
            d.dyad_dset_id === factionId || d.side_a_dset_id === factionId || d.side_b_dset_id === factionId
        );
    }

    /**
     * Normalize events to uniform structure
     * Ensures ChartRenderer receives consistent data regardless of source
     * @private
     */
    _normalizeEvents(events, contextType) {
        return events.map(e => ({
            // Core identifiers
            id: e.id || e.event_id,

            // Casualties (unified field name)
            casualties: e.best || 0,
            best: e.best || 0,
            deaths_a: e.deaths_a || 0,
            deaths_b: e.deaths_b || 0,
            deaths_civilians: e.deaths_civilians || 0,
            deaths_unknown: e.deaths_unknown || 0,

            // Time fields
            year: e.year,
            month: e.month || 1,
            date_start: e.date_start,

            // Location
            country: e.country,
            region: e.region,
            latitude: e.latitude,
            longitude: e.longitude,

            // Violence classification
            violenceType: e.type_of_violence,
            type_of_violence: e.type_of_violence,
            type_of_violence_name: e.type_of_violence_name,

            // Faction info (normalized)
            side_a: e.side_a,
            side_b: e.side_b,
            dyad_name: e.dyad_name,
            dyad_dset_id: e.dyad_dset_id,
            side_a_dset_id: e.side_a_dset_id,
            side_b_dset_id: e.side_b_dset_id,

            // Metadata
            source: e.source_article || e.source,
            source_headline: e.source_headline,

            // Context marker
            _contextType: contextType
        }));
    }

    // ========================================================================
    // UNIFIED FILTERING
    // ========================================================================

    /**
     * Apply filters - unified for both Country and Faction entry points
     * Uses dataFilterManager for optimized O(1) lookups
     * 
     * @param {Object} options - Filter options
     * @param {number} options.year - Max year to include
     * @param {string} options.country - Country name filter
     * @param {string} options.faction - Faction ID filter
     * @param {string} options.region - Region name filter
     * @param {string} options.violenceType - Violence type filter
     * @returns {Array} Filtered events
     */
    applyFilters(options = {}) {
        if (!this.isInitialized) {
            console.warn('DataManager not initialized');
            return [];
        }

        // Use dataFilterManager if available (preferred - has caching)
        if (typeof dataFilterManager !== 'undefined') {
            // Faction-specific lookup (Graph View entry point)
            if (options.faction) {
                return dataFilterManager.getFactionEvents(options.faction, {
                    year: options.year,
                    violenceType: options.violenceType,
                    country: options.country
                });
            }

            // Country-specific lookup (Map View entry point)
            if (options.country) {
                return dataFilterManager.getCountryEvents(options.country, {
                    year: options.year,
                    violenceType: options.violenceType
                });
            }

            // Region-specific lookup
            if (options.region) {
                return dataFilterManager.getRegionEvents(options.region, {
                    year: options.year,
                    violenceType: options.violenceType
                });
            }

            // General filter
            return dataFilterManager.filter(options);
        }

        // Fallback: manual filtering if dataFilterManager not available
        return this._manualFilter(options);
    }

    /**
     * Fallback manual filter method
     * @private
     */
    _manualFilter(options) {
        let result = this.rawData;

        if (options.year !== undefined) {
            result = result.filter(d => d.year <= options.year);
        }
        if (options.country) {
            result = result.filter(d => d.country === options.country);
        }
        if (options.faction) {
            result = result.filter(d =>
                d.side_a === options.faction || d.side_b === options.faction
            );
        }
        if (options.region) {
            result = result.filter(d => d.region === options.region);
        }
        if (options.violenceType) {
            result = result.filter(d => d.type_of_violence_name === options.violenceType);
        }

        return result;
    }

    // ========================================================================
    // AGGREGATION FOR CHARTS
    // ========================================================================

    /**
     * Aggregate events data for all chart types
     * @param {Array} events - Filtered events array
     * @returns {Object} Aggregated data for all charts
     */
    aggregateDataForCharts(events) {
        if (!events || events.length === 0) {
            return {
                byYear: [],
                byViolenceType: [],
                byMonth: [],
                bySeason: [],
                topEvents: [],
                totalEvents: 0,
                totalCasualties: 0
            };
        }

        return {
            byYear: this.aggregateByYear(events),
            byViolenceType: this.aggregateByViolenceType(events),
            byMonth: this.aggregateByMonth(events),
            bySeason: this.aggregateBySeason(events),
            topEvents: this.getTopEvents(events, 10),
            totalEvents: events.length,
            totalCasualties: d3.sum(events, e => e.best)
        };
    }

    /**
     * Aggregate casualties by year
     * @param {Array} events - Events array
     * @returns {Array} [{year, casualties}]
     */
    aggregateByYear(events) {
        const yearData = d3.rollup(
            events,
            v => d3.sum(v, d => d.best),
            d => d.year
        );

        return Array.from(yearData, ([year, casualties]) => ({ year, casualties }))
            .sort((a, b) => a.year - b.year);
    }

    /**
     * Aggregate casualties by violence type
     * @param {Array} events - Events array
     * @returns {Array} [{type, casualties, count}]
     */
    aggregateByViolenceType(events) {
        const typeData = d3.rollup(
            events,
            v => ({
                casualties: d3.sum(v, d => d.best),
                count: v.length
            }),
            d => d.type_of_violence_name
        );

        return Array.from(typeData, ([type, data]) => ({
            type,
            casualties: data.casualties,
            count: data.count
        }))
            .filter(d => d.casualties > 0)
            .sort((a, b) => b.casualties - a.casualties);
    }

    /**
     * Aggregate casualties by year and month (for heatmap)
     * @param {Array} events - Events array
     * @returns {Array} [{year, month, casualties}]
     */
    aggregateByMonth(events) {
        // Filter out events without valid month
        const validEvents = events.filter(d => d.month !== null && d.month >= 1 && d.month <= 12);

        const heatmapData = d3.rollup(
            validEvents,
            v => d3.sum(v, d => d.best),
            d => d.year,
            d => d.month
        );

        const result = [];
        const years = Array.from(new Set(validEvents.map(d => d.year))).sort((a, b) => a - b);

        years.forEach(year => {
            for (let month = 1; month <= 12; month++) {
                const casualties = heatmapData.get(year)?.get(month) || 0;
                result.push({ year, month, casualties });
            }
        });

        return result;
    }

    /**
     * Aggregate casualties by month (for seasonality chart)
     * @param {Array} events - Events array
     * @returns {Array} [{month, monthName, casualties}]
     */
    aggregateBySeason(events) {
        const monthData = d3.rollup(
            events,
            v => d3.sum(v, d => d.best),
            d => d.month
        );

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const result = [];
        for (let i = 1; i <= 12; i++) {
            result.push({
                month: months[i - 1],
                monthNum: i,
                casualties: monthData.get(i) || 0
            });
        }

        return result;
    }

    /**
     * Get top N events by casualties
     * @param {Array} events - Events array
     * @param {number} count - Number of events to return
     * @returns {Array} Top events sorted by casualties
     */
    getTopEvents(events, count = 10) {
        return [...events]
            .sort((a, b) => b.best - a.best)
            .slice(0, count);
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Get processed country data
     * @returns {Array} Country data array
     */
    getProcessedData() {
        return this.processedData || [];
    }

    /**
     * Get country data from map
     * @param {string} countryName - Country name
     * @returns {Object|null} Country data object
     */
    getCountryData(countryName) {
        return this.countryDataMap.get(countryName) || null;
    }

    /**
     * Get all unique regions
     * @returns {Array} Region names
     */
    getRegions() {
        if (typeof dataFilterManager !== 'undefined') {
            return dataFilterManager.getUniqueValues('region');
        }
        return [...new Set(this.rawData.map(d => d.region))];
    }

    /**
     * Get year range
     * @returns {Object} {min, max}
     */
    getYearRange() {
        if (!this.rawData || this.rawData.length === 0) {
            return { min: 1989, max: 2023 };
        }
        return {
            min: d3.min(this.rawData, d => d.year),
            max: d3.max(this.rawData, d => d.year)
        };
    }

    /**
     * Check if data is loaded
     * @returns {boolean}
     */
    isDataLoaded() {
        return this.isInitialized;
    }

    /**
     * Clear cache (delegates to dataFilterManager)
     */
    clearCache() {
        if (typeof dataFilterManager !== 'undefined') {
            dataFilterManager.clearCache();
        }
        if (typeof aggregationManager !== 'undefined') {
            aggregationManager.clearCache();
        }
    }
}

// Export singleton instance
const dataManager = new DataManager();
