// ============================================================================
// UTILS - Utility functions for conflict visualization
// ============================================================================

/**
 * Debounce utility function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle utility function for continuous events like slider dragging
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return d3.format(",d")(num);
}

/**
 * Get violence type color
 * @param {string} typeName - Violence type name
 * @returns {string} Color hex code
 */
function getViolenceTypeColor(typeName) {
    return TYPE_COLORS[typeName] || '#64748b';
}

/**
 * Get region color
 * @param {string} regionName - Region name
 * @returns {string} Color hex code
 */
function getRegionColor(regionName) {
    return REGION_COLORS[regionName] || '#64748b';
}

/**
 * Normalize country name string for matching
 * @param {string} str - Country name to normalize
 * @returns {string} Normalized country name
 */
function normalizeCountryName(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\bthe\b/g, '')
        .replace(/\brepublic of\b/g, '')
        .replace(/\bdemocratic republic of\b/g, '')
        .replace(/\bkingdom of\b/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Get mapped country name for map features
 * @param {string} countryName - Original country name from data
 * @param {Array} mapCountryNames - Available map country names
 * @returns {string|null} Matched map country name or null
 */
function getMapCountryName(countryName, mapCountryNames) {
    // Check direct mapping first
    if (COUNTRY_NAME_MAPPING[countryName]) {
        const mapped = COUNTRY_NAME_MAPPING[countryName];
        if (mapCountryNames.includes(mapped)) {
            return mapped;
        }
    }

    // Check exact match
    if (mapCountryNames.includes(countryName)) {
        return countryName;
    }

    // Try normalized match
    const normalized = normalizeCountryName(countryName);
    for (const mapName of mapCountryNames) {
        if (normalizeCountryName(mapName) === normalized) {
            return mapName;
        }
    }

    return null;
}
