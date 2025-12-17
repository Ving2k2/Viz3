// ============================================================================
// SHARED.JS - Common Constants, Utilities and Functions
// Used by both global.js (Map View) and graph.js (Graph View)
// ============================================================================

const CSV_FILE_PATH = "GEDEvent_v25_1.csv";

// ============================================================================
// CONSTANTS
// ============================================================================

const REGION_COLORS = {
    'Asia': '#ff7f0e',
    'Europe': '#1f77b4',
    'Africa': '#2ca02c',
    'Americas': '#d62728',
    'Middle East': '#9467bd'
};

const TYPE_MAP = {
    "1": "State-based Conflict",
    "2": "Non-state Conflict",
    "3": "One-sided Violence"
};

const TYPE_COLORS = {
    "State-based Conflict": "#d9534f",
    "Non-state Conflict": "#f0ad4e",
    "One-sided Violence": "#0275d8"
};

// Country name mapping for data-to-map matching
const COUNTRY_NAME_MAPPING = {
    // === HISTORICAL/POLITICAL NAME CHANGES ===
    "Cambodia (Kampuchea)": "Cambodia",
    "Kampuchea": "Cambodia",

    // Congo variations
    "DR Congo (Zaire)": "Dem. Rep. Congo",
    "DR Congo": "Dem. Rep. Congo",
    "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "Congo, DR": "Dem. Rep. Congo",
    "Zaire": "Dem. Rep. Congo",
    "Congo": "Congo",
    "Republic of the Congo": "Congo",

    // Myanmar
    "Myanmar (Burma)": "Myanmar",
    "Burma": "Myanmar",

    // Zimbabwe
    "Zimbabwe (Rhodesia)": "Zimbabwe",
    "Rhodesia": "Zimbabwe",

    // Yemen
    "Yemen (North Yemen)": "Yemen",
    "North Yemen": "Yemen",
    "South Yemen": "Yemen",

    // Russia/Soviet Union
    "Russia (Soviet Union)": "Russia",
    "Soviet Union": "Russia",
    "USSR": "Russia",

    // === YUGOSLAVIA SUCCESSOR STATES ===
    "Serbia (Yugoslavia)": "Serbia",
    "Yugoslavia": "Serbia",
    "Serbia and Montenegro": "Serbia",
    "Federal Republic of Yugoslavia": "Serbia",

    "Bosnia-Herzegovina": "Bosnia and Herz.",
    "Bosnia and Herzegovina": "Bosnia and Herz.",
    "Bosnia": "Bosnia and Herz.",

    "Montenegro": "Montenegro",

    "Macedonia": "North Macedonia",
    "FYROM": "North Macedonia",
    "Former Yugoslav Republic of Macedonia": "North Macedonia",

    "Croatia": "Croatia",
    "Slovenia": "Slovenia",

    // === ASIAN COUNTRIES ===
    "Laos": "Lao PDR",
    "Vietnam": "Vietnam",
    "Viet Nam": "Vietnam",

    "Timor-Leste (East Timor)": "Timor-Leste",
    "East Timor": "Timor-Leste",

    "North Korea": "Dem. Rep. Korea",
    "South Korea": "Korea",
    "Republic of Korea": "Korea",

    // === AFRICAN COUNTRIES ===
    "Libya": "Libya",
    "Egypt": "Egypt",
    "Tunisia": "Tunisia",
    "Algeria": "Algeria",
    "Morocco": "Morocco",

    "Mauritania": "Mauritania",
    "Senegal": "Senegal",
    "Gambia": "Gambia",
    "Guinea-Bissau": "Guinea-Bissau",
    "Guinea": "Guinea",
    "Sierra Leone": "Sierra Leone",
    "Liberia": "Liberia",
    "Ivory Coast": "Côte d'Ivoire",
    "Equatorial Guinea": "Eq. Guinea",
    "Gabon": "Gabon",

    "Sudan": "Sudan",
    "South Sudan": "S. Sudan",
    "Eritrea": "Eritrea",
    "Ethiopia": "Ethiopia",
    "Djibouti": "Djibouti",
    "Somalia": "Somalia",
    "Kenya": "Kenya",
    "Uganda": "Uganda",
    "Rwanda": "Rwanda",
    "Burundi": "Burundi",
    "Tanzania": "Tanzania",

    "Angola": "Angola",
    "Zambia": "Zambia",
    "Malawi": "Malawi",
    "Mozambique": "Mozambique",
    "Zimbabwe": "Zimbabwe",
    "Botswana": "Botswana",
    "Namibia": "Namibia",
    "South Africa": "South Africa",
    "Lesotho": "Lesotho",
    "Eswatini": "eSwatini",
    "Swaziland": "eSwatini",
    "Kingdom of eSwatini (Swaziland)": "eSwatini",

    // === EUROPEAN COUNTRIES ===
    "Czech Republic": "Czechia",
    "Czechia": "Czechia",

    "Belarus": "Belarus",
    "Byelarus": "Belarus",
    "Belorussia": "Belarus",

    "Moldova": "Moldova",
    "Moldavia": "Moldova",

    // === AMERICAS ===
    "United States": "United States of America",
    "USA": "United States of America",
    "US": "United States of America",
    "U.S.A.": "United States of America",

    "Dominican Republic": "Dominican Rep.",

    // === MIDDLE EAST ===
    "Palestine": "Palestine",
    "West Bank": "Palestine",
    "Gaza": "Palestine",

    // === ADDITIONAL MAPPINGS ===
    "United Kingdom": "United Kingdom",
    "UK": "United Kingdom",
    "Great Britain": "United Kingdom",

    "Bahrain": "Bahrain",
    "Comoros": "Comoros",
    "Madagascar": "Madagascar",
    "Madagascar (Malagasy)": "Madagascar",
    "Malagasy": "Madagascar",
    "North Macedonia": "North Macedonia",
    "Solomon Islands": "Solomon Is."
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce utility function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle utility function for continuous events like slider dragging
 * Unlike debounce, throttle executes immediately and limits subsequent calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle = false;
    let lastArgs = null;

    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                // Execute with last args if any were queued during throttle
                if (lastArgs) {
                    func.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            // Queue the latest args to execute after throttle period
            lastArgs = args;
        }
    };
}

/**
 * Process raw CSV data into structured format
 * @param {Array} data - Raw CSV data
 * @returns {Array} Processed data array
 */
function processRawData(data) {
    return data.map(d => ({
        year: +d.year,
        month: d.date_start && d.date_start.trim() !== '' ? new Date(d.date_start).getMonth() + 1 : null,
        date_start: d.date_start,
        region: d.region ? d.region.trim() : 'Unknown',
        country: d.country,
        best: +d.best || 0,
        deaths_a: +d.deaths_a || 0,
        deaths_b: +d.deaths_b || 0,
        deaths_civilians: +d.deaths_civilians || 0,
        deaths_unknown: +d.deaths_unknown || 0,
        type_of_violence: d.type_of_violence,
        type_of_violence_name: TYPE_MAP[d.type_of_violence] || 'Unknown',
        dyad_name: d.dyad_name,
        side_a: d.side_a,
        side_b: d.side_b,
        latitude: +d.latitude || null,
        longitude: +d.longitude || null,
        where_description: d.where_description || '',
        source_article: d.source_article || '',
        source_office: d.source_office || '',
        source_date: d.source_date || '',
        source_headline: d.source_headline || ''
    })).filter(d => d.best > 0);
}

/**
 * Aggregate raw data by country
 * @param {Array} data - Processed raw data
 * @param {Map} countryDataMap - Map to store country data
 * @returns {Array} Array of country data objects
 */
function aggregateByCountry(data, countryDataMap) {
    const grouped = d3.group(data, d => d.country);
    countryDataMap.clear();

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

        // Find deadliest event
        const deadliestEvent = events.reduce((max, event) =>
            event.best > max.best ? event : max, events[0]);

        countryDataMap.set(country, {
            name: country,
            region: region,
            totalCasualties: totalCasualties,
            totalEvents: totalEvents,
            events: events,
            eventsWithCoords: eventsWithCoords,
            coordinates: coords,
            typeComposition: typeComposition,
            deadliestEvent: deadliestEvent
        });
    });

    return Array.from(countryDataMap.values());
}

/**
 * Normalize country name string for matching
 * @param {string} str - Country name to normalize
 * @returns {string} Normalized country name
 */
function normalizeCountryName(str) {
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
    // Direct match
    if (mapCountryNames.includes(countryName)) {
        return countryName;
    }

    // Manual mapping
    if (COUNTRY_NAME_MAPPING[countryName] && mapCountryNames.includes(COUNTRY_NAME_MAPPING[countryName])) {
        return COUNTRY_NAME_MAPPING[countryName];
    }

    // Normalized match
    const normalizedTarget = normalizeCountryName(countryName);
    const normalizedMatch = mapCountryNames.find(name => normalizeCountryName(name) === normalizedTarget);
    if (normalizedMatch) {
        return normalizedMatch;
    }

    return null;
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    return d3.format(",d")(num);
}

/**
 * Get violence type color
 * @param {string} typeName - Violence type name
 * @returns {string} Color hex code
 */
function getViolenceTypeColor(typeName) {
    return TYPE_COLORS[typeName] || '#94a3b8';
}

/**
 * Get region color
 * @param {string} regionName - Region name
 * @returns {string} Color hex code
 */
function getRegionColor(regionName) {
    return REGION_COLORS[regionName] || '#94a3b8';
}

// ============================================================================
// PANEL MANAGEMENT (Shared between views)
// ============================================================================

/**
 * Setup panel toggle and reveal functionality
 * @param {Object} options - Configuration options
 */
function setupPanelToggle(options = {}) {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('charts-panel');
    const leftToggle = document.getElementById('left-panel-toggle');
    const rightToggle = document.getElementById('right-panel-toggle');
    const leftTrigger = document.getElementById('left-reveal-trigger');
    const rightTrigger = document.getElementById('right-reveal-trigger');
    const contentWrapper = document.querySelector('.content-wrapper');

    let leftLocked = false;
    let rightLocked = false;

    // Toggle left panel
    if (leftToggle) {
        leftToggle.addEventListener('click', () => {
            leftLocked = !leftLocked;
            leftPanel.classList.toggle('collapsed', leftLocked);
            leftToggle.classList.toggle('collapsed', leftLocked);
            leftToggle.textContent = leftLocked ? '▶' : '◀';
            updateGridLayout();
        });
    }

    // Toggle right panel
    if (rightToggle) {
        rightToggle.addEventListener('click', () => {
            rightLocked = !rightLocked;
            rightPanel.classList.toggle('collapsed', rightLocked);
            rightToggle.classList.toggle('collapsed', rightLocked);
            rightToggle.textContent = rightLocked ? '◀' : '▶';
            updateGridLayout();
        });
    }

    // Hover reveal triggers
    let hoverTimeout;
    const HOVER_DELAY = 200;
    const HIDE_DELAY = 400;

    function showToggleButton(toggle) {
        toggle.style.opacity = '1';
        toggle.style.pointerEvents = 'auto';
    }

    function hideToggleButton(toggle) {
        toggle.style.opacity = '0';
        toggle.style.pointerEvents = 'none';
    }

    if (leftTrigger && leftToggle) {
        leftTrigger.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => showToggleButton(leftToggle), HOVER_DELAY);
        });

        leftTrigger.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => hideToggleButton(leftToggle), HIDE_DELAY);
        });

        leftToggle.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            showToggleButton(leftToggle);
        });

        leftToggle.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideToggleButton(leftToggle), HIDE_DELAY);
        });
    }

    if (rightTrigger && rightToggle) {
        rightTrigger.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => showToggleButton(rightToggle), HOVER_DELAY);
        });

        rightTrigger.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => hideToggleButton(rightToggle), HIDE_DELAY);
        });

        rightToggle.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            showToggleButton(rightToggle);
        });

        rightToggle.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideToggleButton(rightToggle), HIDE_DELAY);
        });
    }

    function updateGridLayout() {
        if (!contentWrapper) return;

        contentWrapper.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');

        if (leftLocked && rightLocked) {
            contentWrapper.classList.add('both-collapsed');
        } else if (leftLocked) {
            contentWrapper.classList.add('left-collapsed');
        } else if (rightLocked) {
            contentWrapper.classList.add('right-collapsed');
        }
    }

    return {
        collapseLeft: () => {
            leftLocked = true;
            leftPanel.classList.add('collapsed');
            leftToggle.classList.add('collapsed');
            leftToggle.textContent = '▶';
            updateGridLayout();
        },
        expandLeft: () => {
            leftLocked = false;
            leftPanel.classList.remove('collapsed');
            leftToggle.classList.remove('collapsed');
            leftToggle.textContent = '◀';
            updateGridLayout();
        },
        collapseRight: () => {
            rightLocked = true;
            rightPanel.classList.add('collapsed');
            rightToggle.classList.add('collapsed');
            rightToggle.textContent = '◀';
            updateGridLayout();
        },
        expandRight: () => {
            rightLocked = false;
            rightPanel.classList.remove('collapsed');
            rightToggle.classList.remove('collapsed');
            rightToggle.textContent = '▶';
            updateGridLayout();
        }
    };
}

// ============================================================================
// TIME SLIDER (Shared base functionality)
// ============================================================================

/**
 * Initialize time slider with default handlers
 * @param {Object} callbacks - Callback functions for slider events
 */
function initializeTimeSlider(callbacks = {}) {
    const slider = document.getElementById('year-slider');
    const playBtn = document.getElementById('play-btn');
    const yearCurrent = document.getElementById('year-current');

    let isPlaying = false;
    let playInterval = null;

    if (!slider) return null;

    // Slider input handler
    slider.addEventListener('input', function () {
        const year = +this.value;
        if (yearCurrent) {
            yearCurrent.textContent = year;
        }
        if (callbacks.onYearChange) {
            callbacks.onYearChange(year);
        }
    });

    // Play button handler
    if (playBtn) {
        playBtn.addEventListener('click', function () {
            if (isPlaying) {
                // Pause
                clearInterval(playInterval);
                isPlaying = false;
                playBtn.textContent = '▶ Play';
            } else {
                // Play
                isPlaying = true;
                playBtn.textContent = '⏸ Pause';

                const maxYear = +slider.max;
                let currentYear = +slider.value;

                // Reset to start if at end
                if (currentYear >= maxYear) {
                    currentYear = +slider.min;
                    slider.value = currentYear;
                    if (yearCurrent) yearCurrent.textContent = currentYear;
                    if (callbacks.onYearChange) callbacks.onYearChange(currentYear);
                }

                playInterval = setInterval(() => {
                    currentYear++;
                    if (currentYear > maxYear) {
                        clearInterval(playInterval);
                        isPlaying = false;
                        playBtn.textContent = '▶ Play';
                        return;
                    }
                    slider.value = currentYear;
                    if (yearCurrent) yearCurrent.textContent = currentYear;
                    if (callbacks.onYearChange) callbacks.onYearChange(currentYear);
                }, 500);
            }
        });
    }

    return {
        setYear: (year) => {
            slider.value = year;
            if (yearCurrent) yearCurrent.textContent = year;
        },
        getYear: () => +slider.value,
        setRange: (min, max) => {
            slider.min = min;
            slider.max = max;
            document.getElementById('year-start').textContent = min;
            document.getElementById('year-end').textContent = max;
        },
        stop: () => {
            if (playInterval) clearInterval(playInterval);
            isPlaying = false;
            if (playBtn) playBtn.textContent = '▶ Play';
        }
    };
}

// ============================================================================
// SHARED UI PANEL COMPONENTS
// Unified rendering functions used by both Map View and Graph View
// ============================================================================

/**
 * Render a stats grid with 2x2 layout
 * @param {D3Selection} container - Container to append to
 * @param {Array} stats - Array of {label, value, color} objects
 */
function renderStatsGrid(container, stats) {
    const grid = container.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "1fr 1fr")
        .style("gap", "0.75rem")
        .style("margin-bottom", "1rem");

    stats.forEach(stat => {
        const cell = grid.append("div")
            .style("background", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "6px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");

        cell.append("div")
            .style("font-size", "0.75rem")
            .style("color", "#94a3b8")
            .style("margin-bottom", "0.25rem")
            .text(stat.label);

        cell.append("div")
            .style("font-weight", "700")
            .style("color", stat.color || "#1e293b")
            .text(stat.value);
    });

    return grid;
}

/**
 * Render activity heatmap by year
 * @param {D3Selection} container - Container to append to
 * @param {Array} events - Array of event objects with year and best fields
 * @param {String} title - Section title
 */
function renderActivityHeatmap(container, events, title = "Activity by Year") {
    if (!events || events.length === 0) return;

    container.append("h4")
        .style("margin", "1rem 0 0.5rem 0")
        .style("font-size", "0.9rem")
        .style("color", "#475569")
        .text(title);

    const heatmapContainer = container.append("div")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("padding", "0.75rem")
        .style("margin-bottom", "1rem")
        .style("overflow-x", "auto");

    // Create 2D heatmap data: year x month
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group by year and month
    const yearMonthData = d3.rollup(
        events.filter(e => e.month), // Only include events with month data
        v => d3.sum(v, e => e.best),
        d => d.year,
        d => d.month
    );

    const years = Array.from(new Set(events.map(e => e.year))).sort((a, b) => a - b);
    const maxCas = d3.max(events, e => e.best) * 2 || 1; // Scale for better visibility

    // Find max casualties in any cell for color scaling
    let maxCellCasualties = 0;
    yearMonthData.forEach(monthMap => {
        monthMap.forEach(casualties => {
            if (casualties > maxCellCasualties) maxCellCasualties = casualties;
        });
    });
    if (maxCellCasualties === 0) maxCellCasualties = 1;

    // Calculate dimensions
    const containerWidth = heatmapContainer.node()?.getBoundingClientRect().width || 280;
    const margin = { top: 5, right: 10, bottom: 25, left: 35 };
    const availableWidth = Math.max(150, containerWidth - margin.left - margin.right - 20);

    // Calculate cell size based on available width and number of years
    const cellWidth = Math.max(6, Math.min(15, (availableWidth - 20) / Math.max(years.length, 1)));
    const cellHeight = 10;
    const cellGap = 1;

    const svgWidth = margin.left + years.length * (cellWidth + cellGap) + margin.right;
    const svgHeight = margin.top + 12 * (cellHeight + cellGap) + margin.bottom;

    const heatmapSvg = heatmapContainer.append("svg")
        .attr("width", Math.max(svgWidth, 150))
        .attr("height", svgHeight);

    // Debug log to verify chart creation
    console.log("[Heatmap Debug] Creating 2D heatmap:", {
        years: years.length,
        svgWidth,
        svgHeight,
        cellWidth,
        containerWidth
    });

    // Draw month labels on Y-axis (left side)
    monthNames.forEach((month, monthIdx) => {
        heatmapSvg.append("text")
            .attr("x", margin.left - 5)
            .attr("y", margin.top + monthIdx * (cellHeight + cellGap) + cellHeight / 2 + 3)
            .attr("text-anchor", "end")
            .style("font-size", "7px")
            .style("fill", "#64748b")
            .text(month);
    });

    // Draw cells for each year-month combination
    years.forEach((year, yearIdx) => {
        const monthMap = yearMonthData.get(year) || new Map();

        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const monthNum = monthIdx + 1;
            const casualties = monthMap.get(monthNum) || 0;
            const intensity = casualties / maxCellCasualties;

            const rect = heatmapSvg.append("rect")
                .attr("x", margin.left + yearIdx * (cellWidth + cellGap))
                .attr("y", margin.top + monthIdx * (cellHeight + cellGap))
                .attr("width", cellWidth)
                .attr("height", cellHeight)
                .attr("fill", casualties > 0 ? d3.interpolateReds(Math.max(0.1, intensity)) : "#f1f5f9")
                .attr("rx", 1)
                .style("cursor", "pointer");

            rect.append("title")
                .text(`${monthNames[monthIdx]} ${year}: ${d3.format(",d")(casualties)} casualties`);
        }
    });

    // Year labels on X-axis (show every 5 years approximately for readability)
    const yearLabelInterval = Math.max(1, Math.ceil(years.length / 8));
    years.filter((y, i) => i % yearLabelInterval === 0).forEach((year) => {
        const idx = years.indexOf(year);
        heatmapSvg.append("text")
            .attr("x", margin.left + idx * (cellWidth + cellGap) + cellWidth / 2)
            .attr("y", margin.top + 12 * (cellHeight + cellGap) + 12)
            .attr("text-anchor", "middle")
            .style("font-size", "7px")
            .style("fill", "#64748b")
            .text(year);
    });

    return heatmapContainer;
}

/**
 * Render violence type breakdown with progress bars
 * @param {D3Selection} container - Container to append to
 * @param {Array} events - Array of event objects
 * @param {String} title - Section title
 */
function renderViolenceTypeBreakdown(container, events, title = "Violence Type Distribution") {
    if (!events || events.length === 0) return;

    const violenceTypes = d3.rollup(
        events,
        v => ({ count: v.length, casualties: d3.sum(v, e => e.best) }),
        d => d.type_of_violence_name
    );

    container.append("h4")
        .style("margin", "1rem 0 0.5rem 0")
        .style("font-size", "0.9rem")
        .style("color", "#475569")
        .text(title);

    const violenceContainer = container.append("div")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("padding", "0.75rem")
        .style("margin-bottom", "1rem");

    const sortedTypes = Array.from(violenceTypes.entries())
        .sort((a, b) => b[1].casualties - a[1].casualties);

    const maxCasualties = d3.max(sortedTypes, d => d[1].casualties);

    sortedTypes.forEach(([type, data]) => {
        const percentage = (data.casualties / maxCasualties) * 100;

        const typeRow = violenceContainer.append("div")
            .style("margin-bottom", "0.5rem");

        typeRow.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("font-size", "0.75rem")
            .style("margin-bottom", "0.25rem")
            .html(`
                <span style="color: #475569; font-weight: 500;">${type}</span>
                <span style="color: #ef4444; font-weight: 600;">${d3.format(",d")(data.casualties)}</span>
            `);

        typeRow.append("div")
            .style("height", "6px")
            .style("background", "#e2e8f0")
            .style("border-radius", "3px")
            .style("overflow", "hidden")
            .append("div")
            .style("width", `${percentage}%`)
            .style("height", "100%")
            .style("background", TYPE_COLORS[type] || "#64748b")
            .style("transition", "width 0.3s ease");
    });

    return violenceContainer;
}

/**
 * Render connected entities list (factions or countries)
 * @param {D3Selection} container - Container to append to
 * @param {Array} entities - Array of entity objects with name, casualties, etc
 * @param {Object} options - {title, entityLabel, onClick, maxHeight}
 */
function renderConnectedEntitiesList(container, entities, options = {}) {
    if (!entities || entities.length === 0) return;

    const {
        title = "Connected Entities",
        maxHeight = "150px",
        onClick = null
    } = options;

    container.append("h4")
        .style("margin", "1rem 0 0.5rem 0")
        .style("font-size", "0.9rem")
        .style("color", "#475569")
        .text(`${title} (${entities.length})`);

    const listContainer = container.append("div")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("padding", "0.75rem")
        .style("max-height", maxHeight)
        .style("overflow-y", "auto")
        .style("margin-bottom", "1rem");

    entities.forEach(entity => {
        const item = listContainer.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("align-items", "center")
            .style("padding", "0.5rem")
            .style("margin-bottom", "0.25rem")
            .style("background", "#f8fafc")
            .style("border-radius", "4px")
            .style("cursor", onClick ? "pointer" : "default")
            .style("transition", "all 0.2s");

        if (onClick) {
            item.on("mouseover", function () {
                d3.select(this).style("background", "#e2e8f0")
                    .style("transform", "translateX(4px)");
            })
                .on("mouseout", function () {
                    d3.select(this).style("background", "#f8fafc")
                        .style("transform", "translateX(0)");
                })
                .on("click", () => onClick(entity));
        }

        // Left side: name with optional color indicator
        const leftDiv = item.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "0.5rem");

        if (entity.color || entity.relationshipType) {
            const indicatorColor = entity.color ||
                (entity.relationshipType === 'ally' ? '#22c55e' : '#ef4444');
            leftDiv.append("div")
                .style("width", "8px")
                .style("height", "8px")
                .style("border-radius", "50%")
                .style("background", indicatorColor);
        }

        leftDiv.append("span")
            .style("font-size", "0.8rem")
            .style("color", "#475569")
            .style("font-weight", "500")
            .text(entity.name || entity.id);

        // Right side: casualties
        if (entity.casualties !== undefined) {
            item.append("span")
                .style("font-size", "0.75rem")
                .style("color", "#ef4444")
                .style("font-weight", "600")
                .text(d3.format(",d")(entity.casualties));
        }
    });

    return listContainer;
}

/**
 * Render complete entity info panel (unified between views)
 * @param {D3Selection} container - Container to append to
 * @param {Object} options - Configuration object
 */
function renderEntityInfoPanel(container, options) {
    const {
        title = "Details",
        subtitle = "",
        entityName = "",
        entitySubtext = "",
        entityColor = "#64748b",
        events = [],
        country = null,
        region = null,
        connectedEntities = [],
        connectedTitle = "Connected Factions",
        showHeatmap = true,
        showViolenceBreakdown = true,
        onEntityClick = null
    } = options;

    // Clear existing content
    container.html("");

    // Panel wrapper with gradient background
    const panel = container.append("div")
        .style("padding", "1.5rem")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)")
        .style("border-radius", "8px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    // Title section
    panel.append("h3")
        .style("margin", "0 0 1rem 0")
        .style("font-size", "1.2rem")
        .style("color", "#1e293b")
        .style("border-bottom", "2px solid #cbd5e1")
        .style("padding-bottom", "0.5rem")
        .text(title);

    // Entity name card
    if (entityName) {
        panel.append("div")
            .style("margin-bottom", "1rem")
            .style("padding", "0.75rem")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("border-left", `4px solid ${entityColor}`)
            .html(`
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${entityName}</div>
                ${entitySubtext ? `<div style="font-size: 0.85rem; color: #64748b;">${entitySubtext}</div>` : ''}
            `);
    }

    // Stats grid
    const totalEvents = events.length;
    const totalCasualties = d3.sum(events, e => e.best);

    const stats = [
        { label: "Events", value: d3.format(",d")(totalEvents), color: "#3b82f6" },
        { label: "Casualties", value: d3.format(",d")(totalCasualties), color: "#ef4444" }
    ];

    if (country) {
        stats.push({ label: "Country", value: country, color: "#8b5cf6" });
    }
    if (region && REGION_COLORS) {
        stats.push({ label: "Region", value: region, color: REGION_COLORS[region] || "#64748b" });
    }
    if (connectedEntities.length > 0) {
        stats.push({ label: connectedTitle, value: connectedEntities.length, color: "#8b5cf6" });
    }

    renderStatsGrid(panel, stats);

    // Activity heatmap
    if (showHeatmap && events.length > 0) {
        renderActivityHeatmap(panel, events);
    }

    // Violence type breakdown
    if (showViolenceBreakdown && events.length > 0) {
        renderViolenceTypeBreakdown(panel, events);
    }

    // Connected entities list
    if (connectedEntities.length > 0) {
        renderConnectedEntitiesList(panel, connectedEntities, {
            title: connectedTitle,
            onClick: onEntityClick
        });
    }

    return panel;
}

/**
 * Render a list of events (e.g. Most Severe Events)
 * @param {D3Selection} container - Container to append to
 * @param {Array} events - Array of event objects
 * @param {Object} options - {title, limit, onClick}
 */
function renderEventsList(container, events, options = {}) {
    if (!events || events.length === 0) return;

    const {
        title = "Most Severe Events",
        limit = 15,
        onClick = null
    } = options;

    container.append("h4")
        .style("margin", "1rem 0 0.5rem 0")
        .style("font-size", "0.9rem")
        .style("color", "#475569")
        .text(title);

    const listContainer = container.append("div")
        .attr("class", "events-list-container") // Use class for styling hooks if needed
        .style("background", "white")
        .style("border-radius", "6px")
        .style("overflow", "hidden")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");

    const sortedEvents = [...events].sort((a, b) => b.best - a.best).slice(0, limit);

    sortedEvents.forEach((event, idx) => {
        const item = listContainer.append("div")
            .style("padding", "0.75rem")
            .style("border-bottom", "1px solid #f1f5f9")
            .style("cursor", onClick ? "pointer" : "default")
            .style("border-left", `4px solid ${getViolenceTypeColor(event.type_of_violence_name)}`)
            .style("transition", "background 0.2s")
            .on("mouseenter", function () {
                if (onClick) d3.select(this).style("background", "#f8fafc");
            })
            .on("mouseleave", function () {
                if (onClick) d3.select(this).style("background", "white");
            })
            .on("click", () => {
                if (onClick) onClick(event);
            });

        // Title Row
        const titleRow = item.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.25rem");

        titleRow.append("span")
            .style("font-weight", "600")
            .style("font-size", "0.85rem")
            .style("color", "#1e293b")
            .text(`${idx + 1}. ${event.date_start ? event.date_start.substring(0, 4) : event.year}`);

        titleRow.append("span")
            .style("font-weight", "700")
            .style("color", "#ef4444")
            .style("font-size", "0.85rem")
            .text(d3.format(",d")(event.best));

        // Subtitle Row
        item.append("div")
            .style("font-size", "0.75rem")
            .style("color", "#64748b")
            .style("line-height", "1.4")
            .text(event.dyad_name || `${event.country} Conflict`);

        // Location Row (if available)
        if (event.where_description) {
            item.append("div")
                .style("font-size", "0.7rem")
                .style("color", "#94a3b8")
                .style("margin-top", "2px")
                .style("white-space", "nowrap")
                .style("overflow", "hidden")
                .style("text-overflow", "ellipsis")
                .text(event.where_description);
        }
    });

    return listContainer;
}

/**
 * Unified updateDashboardUI - used by both Graph and Map views to update the Charts Panel
 * Renders: Casualties Over Time (line chart) + Conflicts with Connected Factions (bar chart) + Most Severe Events
 * @param {Array} events - List of events to display stats for
 * @param {String} title - Main title
 * @param {String} subtitle - Subtitle (e.g. Faction Name or Region)
 * @param {Function} onEventClick - Optional callback when an event in the list is clicked
 */
function updateDashboardUI(events, title, subtitle, onEventClick) {
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // 1. Header
    const header = chartsPanel.append("div")
        .attr("class", "charts-header")
        .style("margin-bottom", "1rem");

    header.append("h3")
        .attr("id", "charts-title")
        .style("margin", "0 0 5px 0")
        .style("font-size", "1.1rem")
        .style("color", "#1e293b")
        .text(title || "Statistics");

    if (subtitle) {
        header.append("p")
            .attr("id", "charts-subtitle")
            .style("margin", "0")
            .style("font-size", "0.85rem")
            .style("color", "#64748b")
            .text(subtitle);
    }

    if (!events || events.length === 0) {
        chartsPanel.append("div")
            .style("padding", "2rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No data available");
        return;
    }

    // 2. Casualties Over Time (Line Chart)
    const timelineContainer = chartsPanel.append("div")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem");
    timelineContainer.append("h4").style("margin", "0 0 10px 0").text("Casualties Over Time");
    const timelineSvg = timelineContainer.append("svg")
        .attr("id", "chart-timeline")
        .attr("class", "stat-chart")
        .attr("width", 380)
        .attr("height", 150);
    renderTimelineChartShared(events, timelineSvg);

    // 3. Conflicts with Connected Factions (Bar Chart)
    const connContainer = chartsPanel.append("div")
        .attr("id", "faction-connected-chart-container")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem");
    connContainer.append("h4").style("margin", "0 0 10px 0").text("Conflicts with Connected Factions");
    const connChartDiv = connContainer.append("div")
        .attr("id", "faction-connected-chart");
    renderConnectedFactionsChartShared(events, connChartDiv);

    // 4. Most Severe Events List
    const clickHandler = onEventClick || (typeof highlightAndZoomToEvent === 'function' ? highlightAndZoomToEvent : null);
    renderEventsList(chartsPanel, events, {
        title: "Most Severe Events",
        limit: 20,
        onClick: clickHandler
    });
}

// Render DUAL-AXIS chart: Casualties (line) + Events Count (bars) by Year
function renderTimelineChartShared(events, svg) {
    const width = 380, height = 150;
    const margin = { top: 15, right: 45, bottom: 25, left: 45 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate by year: casualties and events count
    const yearDataMap = d3.rollup(events,
        v => ({ casualties: d3.sum(v, e => e.best), count: v.length }),
        d => d.year
    );
    const data = Array.from(yearDataMap, ([year, values]) => ({ year, ...values }))
        .sort((a, b) => a.year - b.year);

    if (data.length === 0) return;

    const x = d3.scaleBand()
        .domain(data.map(d => d.year))
        .range([0, chartWidth])
        .padding(0.3);

    const yCasualties = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.casualties)])
        .nice()
        .range([chartHeight, 0]);

    const yEvents = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([chartHeight, 0]);

    // Draw bars (Events Count - blue)
    g.selectAll(".event-bar")
        .data(data)
        .join("rect")
        .attr("class", "event-bar")
        .attr("x", d => x(d.year))
        .attr("y", d => yEvents(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - yEvents(d.count))
        .attr("fill", "rgba(59, 130, 246, 0.4)")
        .attr("rx", 2)
        .append("title")
        .text(d => `${d.year}: ${d.count} events, ${d3.format(",d")(d.casualties)} casualties`);

    // Draw line (Casualties - red)
    const line = d3.line()
        .x(d => x(d.year) + x.bandwidth() / 2)
        .y(d => yCasualties(d.casualties));

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2.5)
        .attr("d", line);

    // Draw dots on line
    g.selectAll(".casualty-dot")
        .data(data)
        .join("circle")
        .attr("class", "casualty-dot")
        .attr("cx", d => x(d.year) + x.bandwidth() / 2)
        .attr("cy", d => yCasualties(d.casualties))
        .attr("r", 3)
        .attr("fill", "#ef4444");

    // X-axis (years)
    const yearLabels = data.filter((d, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0);
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickValues(yearLabels.map(d => d.year)).tickFormat(d3.format("d")))
        .style("font-size", "8px");

    // Left Y-axis (Casualties - red)
    g.append("g")
        .call(d3.axisLeft(yCasualties).ticks(4).tickFormat(d3.format(".2s")))
        .style("font-size", "8px")
        .selectAll("text").style("fill", "#ef4444");

    // Right Y-axis (Events - blue)
    g.append("g")
        .attr("transform", `translate(${chartWidth},0)`)
        .call(d3.axisRight(yEvents).ticks(4))
        .style("font-size", "8px")
        .selectAll("text").style("fill", "#3b82f6");

    // Legend
    const legendG = g.append("g")
        .attr("transform", `translate(${chartWidth / 2 - 60}, -8)`);

    legendG.append("line").attr("x1", 0).attr("y1", 5).attr("x2", 15).attr("y2", 5)
        .attr("stroke", "#ef4444").attr("stroke-width", 2);
    legendG.append("text").attr("x", 18).attr("y", 8).text("Casualties")
        .style("font-size", "7px").attr("fill", "#ef4444");

    legendG.append("rect").attr("x", 70).attr("y", 0).attr("width", 10).attr("height", 10)
        .attr("fill", "rgba(59, 130, 246, 0.6)");
    legendG.append("text").attr("x", 83).attr("y", 8).text("Events")
        .style("font-size", "7px").attr("fill", "#3b82f6");
}

// Render Connected Factions bar chart
function renderConnectedFactionsChartShared(events, container) {
    container.html("");

    // Get factions from events
    const factionCasualties = {};
    events.forEach(event => {
        if (event.side_a) {
            if (!factionCasualties[event.side_a]) {
                factionCasualties[event.side_a] = { casualties: 0, events: 0, isOpponent: false };
            }
            factionCasualties[event.side_a].casualties += event.deaths_a || 0;
            factionCasualties[event.side_a].events++;
        }
        if (event.side_b) {
            if (!factionCasualties[event.side_b]) {
                factionCasualties[event.side_b] = { casualties: 0, events: 0, isOpponent: true };
            }
            factionCasualties[event.side_b].casualties += event.deaths_b || 0;
            factionCasualties[event.side_b].events++;
        }
    });

    const topFactions = Object.entries(factionCasualties)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.casualties - a.casualties)
        .slice(0, 8);

    if (topFactions.length === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No faction data available");
        return;
    }

    const maxCasualties = d3.max(topFactions, d => d.casualties) || 1;

    // Horizontal bar list
    const barList = container.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "0.5rem");

    topFactions.forEach(faction => {
        const barRow = barList.append("div")
            .attr("class", "conn-faction-bar-row")
            .style("cursor", "pointer")
            .style("padding", "0.5rem")
            .style("background", "#f8fafc")
            .style("border-radius", "6px")
            .style("transition", "all 0.2s ease")
            .on("mouseenter", function () {
                d3.select(this).style("background", "#e0e7ff");
            })
            .on("mouseleave", function () {
                d3.select(this).style("background", "#f8fafc");
            });

        // Faction name row
        barRow.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.25rem")
            .html(`
                <span style="font-size: 0.8rem; font-weight: 600; color: #1e293b;">
                    ${faction.id.length > 35 ? faction.id.substring(0, 32) + '...' : faction.id}
                </span>
                <span style="font-size: 0.8rem; color: ${faction.isOpponent ? '#ef4444' : '#22c55e'}; font-weight: 600;">
                    ${faction.isOpponent ? 'Opponent' : 'Ally'}
                </span>
            `);

        // Horizontal bar
        const barPercent = (faction.casualties / maxCasualties) * 100;
        barRow.append("div")
            .style("height", "12px")
            .style("background", "#e2e8f0")
            .style("border-radius", "6px")
            .style("overflow", "hidden")
            .append("div")
            .style("height", "100%")
            .style("width", `${barPercent}%`)
            .style("background", faction.isOpponent ?
                "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)" :
                "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)")
            .style("border-radius", "6px");

        // Casualty number
        barRow.append("div")
            .style("font-size", "0.7rem")
            .style("color", "#64748b")
            .style("margin-top", "0.15rem")
            .text(`${d3.format(",d")(faction.casualties)} casualties`);
    });

    // Legend
    const legend = container.append("div")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("gap", "1rem")
        .style("margin-top", "0.75rem")
        .style("padding-top", "0.5rem")
        .style("border-top", "1px solid #e2e8f0");

    legend.append("div")
        .style("font-size", "0.75rem")
        .html('<span style="display:inline-block;width:12px;height:12px;background:#22c55e;border-radius:2px;margin-right:4px;"></span>Ally');
    legend.append("div")
        .style("font-size", "0.75rem")
        .html('<span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:2px;margin-right:4px;"></span>Opponent');
}

