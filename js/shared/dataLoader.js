// ============================================================================
// DATA LOADER - CSV loading, processing, and caching with IndexedDB
// ============================================================================

/**
 * Process raw CSV data into structured format
 * @param {Array} data - Raw CSV data
 * @returns {Array} Processed data array
 */
function processRawData(data) {
    return data.map(row => ({
        id: row.id,
        year: +row.year,
        type_of_violence: +row.type_of_violence,
        type_of_violence_name: TYPE_MAP[row.type_of_violence] || "Unknown",
        conflict_name: row.conflict_name,
        dyad_name: row.dyad_name,
        side_a: row.side_a,
        side_b: row.side_b,
        country: row.country,
        region: row.region,
        latitude: +row.latitude,
        longitude: +row.longitude,
        best: +row.best || 0,
        low: +row.low || 0,
        high: +row.high || 0,
        deaths_a: +row.deaths_a || 0,
        deaths_b: +row.deaths_b || 0,
        deaths_civilians: +row.deaths_civilians || 0,
        deaths_unknown: +row.deaths_unknown || 0,
        date_start: row.date_start,
        date_end: row.date_end,
        where_description: row.where_prec_description || row.where_description,
        source_article: row.source_article,
        source_headline: row.source_headline
    }));
}

/**
 * Aggregate raw data by country
 * @param {Array} data - Processed raw data
 * @param {Map} countryDataMap - Map to store country data
 * @returns {Array} Array of country data objects
 */
function aggregateByCountry(data, countryDataMap) {
    countryDataMap.clear();

    data.forEach(event => {
        if (!countryDataMap.has(event.country)) {
            countryDataMap.set(event.country, {
                name: event.country,
                region: event.region,
                totalCasualties: 0,
                eventCount: 0,
                coordinates: null,
                events: [],
                eventsWithCoords: []
            });
        }

        const country = countryDataMap.get(event.country);
        country.totalCasualties += event.best;
        country.eventCount++;
        country.events.push(event);

        if (event.latitude && event.longitude) {
            country.eventsWithCoords.push(event);
            if (!country.coordinates) {
                country.coordinates = [event.longitude, event.latitude];
            }
        }
    });

    return Array.from(countryDataMap.values());
}

// ============================================================================
// IndexedDB Caching for large dataset
// ============================================================================

const DB_NAME = 'ConflictMapCache';
const DB_VERSION = 1;
const STORE_NAME = 'processedData';

class DataCache {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    async get(key) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result?.data);
        });
    }

    async set(key, data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({ key, data, timestamp: Date.now() });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

const dataCache = new DataCache();

// ============================================================================
// Data Filter Manager - Optimized filtering with indexing
// ============================================================================

class DataFilterManager {
    constructor() {
        this.rawData = null;
        this.indices = null;
        this.cache = new Map();
        this.maxCacheSize = 100;
    }

    initialize(rawData) {
        this.rawData = rawData;
        this.buildIndices(rawData);
        this.cache.clear();
    }

    buildIndices(data) {
        this.indices = {
            byYear: new Map(),
            byRegion: new Map(),
            byCountry: new Map(),
            byViolenceType: new Map(),
            byFaction: new Map()
        };

        data.forEach((event, idx) => {
            // Year index
            if (!this.indices.byYear.has(event.year)) {
                this.indices.byYear.set(event.year, []);
            }
            this.indices.byYear.get(event.year).push(idx);

            // Region index
            if (!this.indices.byRegion.has(event.region)) {
                this.indices.byRegion.set(event.region, []);
            }
            this.indices.byRegion.get(event.region).push(idx);

            // Country index
            if (!this.indices.byCountry.has(event.country)) {
                this.indices.byCountry.set(event.country, []);
            }
            this.indices.byCountry.get(event.country).push(idx);

            // Violence type index
            if (!this.indices.byViolenceType.has(event.type_of_violence_name)) {
                this.indices.byViolenceType.set(event.type_of_violence_name, []);
            }
            this.indices.byViolenceType.get(event.type_of_violence_name).push(idx);

            // Faction index (both sides)
            if (event.side_a) {
                if (!this.indices.byFaction.has(event.side_a)) {
                    this.indices.byFaction.set(event.side_a, []);
                }
                this.indices.byFaction.get(event.side_a).push(idx);
            }
            if (event.side_b) {
                if (!this.indices.byFaction.has(event.side_b)) {
                    this.indices.byFaction.set(event.side_b, []);
                }
                this.indices.byFaction.get(event.side_b).push(idx);
            }
        });
    }

    filter(options = {}) {
        const cacheKey = this.getCacheKey(options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let result = this.rawData;

        if (options.year) {
            result = result.filter(e => e.year <= options.year);
        }
        if (options.regions && options.regions.length > 0) {
            result = result.filter(e => options.regions.includes(e.region));
        }
        if (options.country) {
            result = result.filter(e => e.country === options.country);
        }
        if (options.violenceType) {
            result = result.filter(e => e.type_of_violence_name === options.violenceType);
        }

        this.setCache(cacheKey, result);
        return result;
    }

    getRegionEvents(region, options = {}) {
        return this.filter({ ...options, regions: [region] });
    }

    getCountryEvents(country, options = {}) {
        return this.filter({ ...options, country });
    }

    getFactionEvents(factionId, options = {}) {
        const indices = this.indices.byFaction.get(factionId) || [];
        let result = indices.map(idx => this.rawData[idx]);

        if (options.year) {
            result = result.filter(e => e.year <= options.year);
        }
        if (options.violenceType) {
            result = result.filter(e => e.type_of_violence_name === options.violenceType);
        }

        return result;
    }

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
}

const dataFilterManager = new DataFilterManager();

// ============================================================================
// Aggregation Manager - Data aggregation utilities
// ============================================================================

const aggregationManager = {
    aggregateByCountry: aggregateByCountry,

    aggregateByYear(events) {
        const byYear = d3.rollup(events, v => d3.sum(v, e => e.best), d => d.year);
        return Array.from(byYear, ([year, casualties]) => ({ year, casualties }))
            .sort((a, b) => a.year - b.year);
    },

    aggregateByViolenceType(events) {
        const byType = d3.rollup(events,
            v => ({ casualties: d3.sum(v, e => e.best), count: v.length }),
            d => d.type_of_violence_name
        );
        return Array.from(byType, ([type, data]) => ({ type, ...data }));
    },

    aggregateByMonth(events) {
        const byMonth = d3.rollup(events,
            v => d3.sum(v, e => e.best),
            d => d.year,
            d => new Date(d.date_start).getMonth() + 1
        );

        const result = [];
        byMonth.forEach((months, year) => {
            months.forEach((casualties, month) => {
                result.push({ year, month, casualties });
            });
        });
        return result;
    },

    getTopEvents(events, count = 10) {
        return [...events]
            .sort((a, b) => b.best - a.best)
            .slice(0, count);
    }
};
