// ============================================================================
// AGGREGATION MANAGER - Centralized aggregation with caching
// ============================================================================

class AggregationManager {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 50;
    }

    /**
     * Aggregate by country with caching
     * Uses data fingerprint for cache key
     */
    aggregateByCountry(data, countryDataMap) {
        const cacheKey = this.getDataFingerprint(data, 'country');

        if (this.cache.has(cacheKey)) {
            // Return cached result
            const cached = this.cache.get(cacheKey);

            // Update the provided Map
            if (countryDataMap) {
                countryDataMap.clear();
                cached.forEach(item => {
                    countryDataMap.set(item.name, item);
                });
            }

            return cached;
        }

        // Perform aggregation
        const grouped = d3.group(data, d => d.country);
        if (countryDataMap) {
            countryDataMap.clear();
        }

        const aggregated = [];

        grouped.forEach((events, country) => {
            const totalCasualties = d3.sum(events, d => d.best);
            const totalEvents = events.length;
            const region = events[0].region;

            const typeComposition = d3.rollup(
                events,
                v => ({
                    count: v.length,
                    casualties: d3.sum(v, d => d.best)
                }),
                d => d.type_of_violence_name
            );

            const eventsWithCoords = events.filter(e => e.latitude && e.longitude);
            let coords = null;

            if (eventsWithCoords.length > 0) {
                const avgLat = d3.mean(eventsWithCoords, e => e.latitude);
                const avgLon = d3.mean(eventsWithCoords, e => e.longitude);
                coords = [avgLon, avgLat];
            }

            const deadliestEvent = events.reduce((max, event) =>
                event.best > max.best ? event : max, events[0]
            );

            const countryData = {
                name: country,
                region: region,
                totalCasualties: totalCasualties,
                totalEvents: totalEvents,
                events: events,
                eventsWithCoords: eventsWithCoords,
                coordinates: coords,
                typeComposition: typeComposition,
                deadliestEvent: deadliestEvent
            };

            if (countryDataMap) {
                countryDataMap.set(country, countryData);
            }

            aggregated.push(countryData);
        });

        // Cache result
        this.setCache(cacheKey, aggregated);

        return aggregated;
    }

    /**
     * Create fingerprint for data caching
     * Uses data length + hash of first/last items
     */
    getDataFingerprint(data, type) {
        if (!data || data.length === 0) {
            return `${type}-empty`;
        }

        const first = data[0];
        const last = data[data.length - 1];

        return `${type}-${data.length}-${first.year}-${first.country}-${last.year}-${last.country}`;
    }

    /**
     * Cache management with LRU eviction
     */
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

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Export singleton instance
const aggregationManager = new AggregationManager();
