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
    // Historical/Political name changes
    "Cambodia (Kampuchea)": "Cambodia",
    "Kampuchea": "Cambodia",
    "DR Congo (Zaire)": "Dem. Rep. Congo",
    "DR Congo": "Dem. Rep. Congo",
    "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "Congo, DR": "Dem. Rep. Congo",
    "Zaire": "Dem. Rep. Congo",
    "Myanmar (Burma)": "Myanmar",
    "Burma": "Myanmar",
    "Zimbabwe (Rhodesia)": "Zimbabwe",
    "Rhodesia": "Zimbabwe",
    "Yemen (North Yemen)": "Yemen",
    "Russia (Soviet Union)": "Russia",
    "Soviet Union": "Russia",
    "USSR": "Russia",
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
    "Ivory Coast": "Côte d'Ivoire",
    "East Timor": "Timor-Leste",
    "Timor-Leste (East Timor)": "Timor-Leste",
    "Laos": "Lao PDR",
    "Vietnam": "Vietnam",
    "Viet Nam": "Vietnam",
    "North Korea": "Dem. Rep. Korea",
    "South Korea": "Korea",
    "Central African Republic": "Central African Rep.",
    "Dominican Republic": "Dominican Rep.",
    "South Sudan": "S. Sudan",
    "Czech Republic": "Czechia",
    "United States": "United States of America",
    "USA": "United States of America",
    "Eswatini": "eSwatini",
    "Swaziland": "eSwatini",
    "Kingdom of eSwatini (Swaziland)": "eSwatini",
    "Madagascar (Malagasy)": "Madagascar",
    "Malagasy": "Madagascar",
    "North Macedonia": "North Macedonia",
    "Solomon Islands": "Solomon Is.",
    "Bahrain": "Bahrain",
    "Comoros": "Comoros"
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
        region: d.region || 'Unknown',
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
