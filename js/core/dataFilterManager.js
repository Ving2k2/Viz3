// ============================================================================
// DATA FILTER MANAGER - Centralized filtering with indexing and caching
// ============================================================================

class DataFilterManager {
    constructor() {
        this.rawData = null;
        this.indices = null;
        this.cache = new Map();
        this.maxCacheSize = 100;
    }

    /**
     * Initialize with raw data and build indices
     * Call this once after loading CSV data
     */
    initialize(rawData) {
        this.rawData = rawData;
        this.indices = this.buildIndices(rawData);
    }

    /**
     * Build all indices in one pass - O(n) complexity, only runs once
     */
    buildIndices(data) {
        const indices = {
            byYear: new Map(),
            byRegion: new Map(),
            byCountry: new Map(),
            byFaction: new Map(),
            byViolenceType: new Map(),
            // OPTIMIZED: Pre-computed cumulative indices for time slider
            cumulativeByYear: new Map()
        };

        data.forEach((event, idx) => {
            // Year index
            if (!indices.byYear.has(event.year)) {
                indices.byYear.set(event.year, []);
            }
            indices.byYear.get(event.year).push(idx);

            // Region index
            if (!indices.byRegion.has(event.region)) {
                indices.byRegion.set(event.region, []);
            }
            indices.byRegion.get(event.region).push(idx);

            // Country index
            if (!indices.byCountry.has(event.country)) {
                indices.byCountry.set(event.country, []);
            }
            indices.byCountry.get(event.country).push(idx);

            // Faction index - THE KEY OPTIMIZATION!
            const factions = [event.side_a, event.side_b].filter(f => f);
            factions.forEach(faction => {
                if (!indices.byFaction.has(faction)) {
                    indices.byFaction.set(faction, []);
                }
                indices.byFaction.get(faction).push(idx);
            });

            // Violence type index
            const type = event.type_of_violence_name;
            if (!indices.byViolenceType.has(type)) {
                indices.byViolenceType.set(type, []);
            }
            indices.byViolenceType.get(type).push(idx);
        });

        // OPTIMIZED: Build cumulative year indices for instant time slider lookup
        // This allows O(1) access to all events up to a given year
        const sortedYears = Array.from(indices.byYear.keys()).sort((a, b) => a - b);
        let cumulativeIndices = [];

        sortedYears.forEach(year => {
            cumulativeIndices = cumulativeIndices.concat(indices.byYear.get(year));
            // Store a copy to prevent mutation issues
            indices.cumulativeByYear.set(year, [...cumulativeIndices]);
        });

        console.log(`📊 DataFilterManager: Built cumulative indices for ${sortedYears.length} years`);

        return indices;
    }

    /**
     * Main filter method with caching
     * Options: { year, region, country, faction, violenceType, regions[] }
     */
    filter(options = {}) {
        const cacheKey = this.getCacheKey(options);

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Start with most specific index
        let resultIndices = this.getBaseIndices(options);
        let result = resultIndices.map(i => this.rawData[i]);

        // Apply additional filters
        result = this.applyFilters(result, options);

        // Cache result with LRU eviction
        this.setCache(cacheKey, result);

        return result;
    }

    /**
     * Get base set of indices from most specific filter
     */
    getBaseIndices(options) {
        if (options.faction) {
            return this.indices.byFaction.get(options.faction) || [];
        }
        if (options.country) {
            return this.indices.byCountry.get(options.country) || [];
        }
        if (options.region) {
            return this.indices.byRegion.get(options.region) || [];
        }
        if (options.violenceType) {
            return this.indices.byViolenceType.get(options.violenceType) || [];
        }

        // All events
        return this.rawData.map((_, i) => i);
    }

    /**
     * Apply additional filters to result set
     */
    applyFilters(data, options) {
        let result = data;

        // Year filter - always apply if specified
        if (options.year !== undefined) {
            result = result.filter(d => d.year <= options.year);
        }

        // Regions filter (array of regions)
        if (options.regions && Array.isArray(options.regions)) {
            result = result.filter(d => options.regions.includes(d.region));
        }

        // Single region filter (when not used as base index)
        if (options.region && !options.faction && !options.country) {
            // Already used as base, skip
        } else if (options.region) {
            result = result.filter(d => d.region === options.region);
        }

        // Violence type filter - apply if not used as base index
        if (options.violenceType) {
            result = result.filter(d => d.type_of_violence_name === options.violenceType);
        }

        // Country filter when faction is base
        if (options.country && options.faction) {
            result = result.filter(d => d.country === options.country);
        }

        return result;
    }

    /**
     * Get faction events - optimized O(1) lookup
     */
    getFactionEvents(factionId, options = {}) {
        const cacheKey = `faction-${factionId}-${JSON.stringify(options)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const indices = this.indices.byFaction.get(factionId) || [];
        let events = indices.map(i => this.rawData[i]);

        if (options.year !== undefined) {
            events = events.filter(e => e.year <= options.year);
        }

        if (options.violenceType) {
            events = events.filter(e => e.type_of_violence_name === options.violenceType);
        }

        if (options.country) {
            events = events.filter(e => e.country === options.country);
        }

        this.setCache(cacheKey, events);
        return events;
    }

    /**
     * Get events up to a specific year - optimized for time slider
     * @param {number} year - Max year to include
     * @param {Object} options - Additional filters { region, regions[], violenceType }
     */
    getEventsUpToYear(year, options = {}) {
        return this.filter({ year, ...options });
    }

    /**
     * Get events for a specific region with year filter
     */
    getRegionEvents(region, options = {}) {
        const cacheKey = `region-${region}-${JSON.stringify(options)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const indices = this.indices.byRegion.get(region) || [];
        let events = indices.map(i => this.rawData[i]);

        if (options.year !== undefined) {
            events = events.filter(e => e.year <= options.year);
        }

        if (options.violenceType) {
            events = events.filter(e => e.type_of_violence_name === options.violenceType);
        }

        this.setCache(cacheKey, events);
        return events;
    }

    /**
     * Get events for a specific country with year filter
     */
    getCountryEvents(country, options = {}) {
        const cacheKey = `country-${country}-${JSON.stringify(options)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const indices = this.indices.byCountry.get(country) || [];
        let events = indices.map(i => this.rawData[i]);

        if (options.year !== undefined) {
            events = events.filter(e => e.year <= options.year);
        }

        if (options.violenceType) {
            events = events.filter(e => e.type_of_violence_name === options.violenceType);
        }

        this.setCache(cacheKey, events);
        return events;
    }

    /**
     * Cache management
     */
    getCacheKey(options) {
        return JSON.stringify(options);
    }

    setCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Get all unique values for a field
     */
    getUniqueValues(field) {
        const map = this.indices[`by${field.charAt(0).toUpperCase() + field.slice(1)}`];
        return map ? Array.from(map.keys()) : [];
    }
}

// Export singleton instance
const dataFilterManager = new DataFilterManager();
