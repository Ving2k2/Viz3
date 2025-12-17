// ============================================================================
// GLOBAL CONFLICT MAP VISUALIZATION - MAP VIEW (UNIFIED)
// Combines: World View from global.js + Country/Event View from graph.js Faction logic
// ============================================================================

// Note: CSV_FILE_PATH, REGION_COLORS, TYPE_MAP, TYPE_COLORS are defined in shared.js

// === GLOBAL STATE ===
let rawData = [];
let processedData = [];
let countryData = new Map();
let activeRegions = Object.keys(REGION_COLORS);
let worldMapFeatures = null;
let provinceFeatures = null;

// === USE SHARED VIEW STATE MANAGER ===
const viewState = viewStateManager.getState();

// === PERFORMANCE OPTIMIZATION ===
let lastEventSelectTime = 0;

// === D3 SELECTIONS ===
let mapWidth, mapHeight;
const svg = d3.select("#world-map");
const container = svg.append("g");
const mapGroup = container.append("g").attr("class", "map-group");
const bubblesGroup = container.append("g").attr("class", "bubbles-group");

let projection, path, zoom;

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

function pushViewHistory() {
    viewStateManager.pushHistory();
}

function navigateBack() {
    // Priority 1: If event is selected, deselect event (stay in country view)
    if (viewState.selectedEvent && viewState.mode === 'event') {
        viewState.selectedEvent = null;
        viewState.mode = 'country';

        bubblesGroup.selectAll(".event-bubble")
            .classed("selected-event", false)
            .classed("unselected-event", false)
            .style("opacity", 0.8);

        if (viewState.selectedCountryData) {
            updateAllCharts();
            updateCountryPanel();
        }
        return true;
    }

    // Priority 2: If in country view, return to world
    if (viewState.mode === 'country') {
        returnToWorldView();
        return true;
    }

    // Priority 3: If in region view, return to world view
    if (viewState.mode === 'region') {
        returnToWorldView();
        return true;
    }

    d3.select("#reset-zoom").style("display", "none");
    return false;
}

function returnToWorldView() {
    viewState.mode = 'world';
    viewState.selectedCountryName = null;
    viewState.selectedCountryData = null;
    viewState.selectedEvent = null;
    viewState.selectedFaction = null;
    viewState.selectedRegion = null;

    // Reset zoom
    svg.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);

    // Clear SVG bubbles
    bubblesGroup.selectAll(".event-bubble").remove();
    bubblesGroup.selectAll(".capital-marker").remove();

    // Destroy Canvas bubbles completely to prevent blocking SVG interactions
    if (canvasBubbleRenderer.canvas) {
        canvasBubbleRenderer.destroy();
    }

    // Restore world view
    mapGroup.selectAll(".country")
        .transition()
        .duration(500)
        .style("opacity", 1)
        .style("pointer-events", "auto");

    mapGroup.select(".sphere").style("display", "block").style("opacity", 1);
    mapGroup.select(".graticule").style("display", "block").style("opacity", 1);

    // Reset LEFT panel - show global stats, hide country info
    const leftPanel = d3.select("#left-panel");
    leftPanel.select(".stats-container").style("display", "block");
    leftPanel.select(".legend-section").style("display", "block");
    leftPanel.select(".violence-filter-section").style("display", "block");
    leftPanel.select("#country-panel").style("display", "none");

    // Update left panel stats
    updateStats();

    // Reset RIGHT panel - show and populate with Top Countries List
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // Header for right panel
    chartsPanel.append("div")
        .attr("class", "charts-header")
        .html(`
            <h3 id="charts-title" style="margin: 0 0 5px 0; font-size: 18px;">Top Countries by Casualties</h3>
            <p id="charts-subtitle" style="margin: 0; font-size: 14px; color: #64748b;">Click to view country details</p>
        `);

    // Redraw world bubbles and top countries list
    setTimeout(() => {
        drawConflictBubbles();
        renderTopCountriesList();
    }, 100);

    d3.select("#reset-zoom").style("display", "none");
}

// ============================================================================
// INITIALIZATION & RESPONSIVE
// ============================================================================

function initializeMap() {
    const mapSection = document.querySelector('.map-section');
    mapWidth = mapSection.clientWidth;
    mapHeight = mapSection.clientHeight;

    svg.attr("width", mapWidth).attr("height", mapHeight);

    const result = renderingEngine.initialize(mapWidth, mapHeight);
    projection = result.projection;
    path = result.path;

    const debouncedZoomUpdate = debounce(() => {
        if (viewState.mode === 'region') {
            updateRegionBubbles();
        } else if (viewState.mode === 'world') {
            updateWorldBubbles();
        } else if (viewState.mode === 'country') {
            updateEventBubbleSizes();
        }
    }, 50);

    zoom = d3.zoom()
        .scaleExtent([1, 500])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
            viewState.zoomScale = event.transform.k;
            viewState.zoomTransform = event.transform;

            // Update canvas transform for bubble positioning
            if (canvasBubbleRenderer.canvas) {
                canvasBubbleRenderer.updateTransform(event.transform);
            }

            debouncedZoomUpdate();
        });

    svg.call(zoom);

    createTimeSlider();
    setupModal();
    setupBackButton();
    setupViewToggle();
}

window.addEventListener('resize', () => {
    initializeMap();
    if (viewState.mode === 'world') {
        drawWorldMap();
        drawConflictBubbles();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        drawEventBubbles();
        updateAllCharts();
        updateCountryPanel();
    } else if (viewState.mode === 'event') {
        renderEventDetailsView(viewState.selectedEvent);
    }
});

// ============================================================================
// DATA PROCESSING (From global.js)
// ============================================================================

async function loadData() {
    try {
        const data = await d3.csv(CSV_FILE_PATH);
        rawData = processRawData(data);
        dataFilterManager.initialize(rawData);
        processedData = aggregationManager.aggregateByCountry(rawData, countryData);

        updateStats();
        createLegend();
        createViolenceTypeFilter();

        // Initialize slider range
        const years = rawData.map(d => d.year);
        const minYear = d3.min(years);
        const maxYear = d3.max(years);

        const slider = document.getElementById('year-slider');
        if (slider) {
            slider.min = minYear;
            slider.max = maxYear;
            slider.value = maxYear;
            document.getElementById('year-start').textContent = minYear;
            document.getElementById('year-end').textContent = maxYear;
            document.getElementById('year-current').textContent = maxYear;
        }
    } catch (error) {
        console.error("❌ Error loading data:", error);
    }
}

function updateStats() {
    const currentYear = +document.getElementById('year-slider').value;

    let filterOptions = { year: currentYear };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    let filteredData;
    if (viewState.selectedRegion) {
        filteredData = dataFilterManager.getRegionEvents(viewState.selectedRegion, filterOptions);
    } else if (viewState.mode === 'country' && viewState.selectedCountryName) {
        filteredData = dataFilterManager.getCountryEvents(viewState.selectedCountryName, filterOptions);
    } else {
        filterOptions.regions = activeRegions;
        filteredData = dataFilterManager.filter(filterOptions);
    }

    const totalEvents = filteredData.length;
    const totalCasualties = d3.sum(filteredData, d => d.best);

    d3.select("#total-events").text(d3.format(",d")(totalEvents));
    d3.select("#total-casualties").text(d3.format(",d")(totalCasualties));

    if (viewState.mode === 'world' && !viewState.selectedRegion) {
        drawRegionalStackedBars(filteredData);
    } else {
        d3.select("#regional-bars").remove();
    }
}

// ============================================================================
// MAP RENDERING (From global.js)
// ============================================================================

async function drawWorldMap() {
    await renderingEngine.drawWorldMap(mapGroup, handleCountryClick);
    worldMapFeatures = renderingEngine.getWorldMapFeatures();
}

function drawConflictBubbles() {
    bubblesGroup.selectAll(".conflict-bubble").interrupt();

    const currentYear = +document.getElementById('year-slider').value;

    const filterOptions = { year: currentYear, regions: activeRegions };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }
    const currentYearData = dataFilterManager.filter(filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    let filteredCountries = currentCountryData.filter(d =>
        activeRegions.includes(d.region) && d.coordinates
    );

    renderingEngine.drawConflictBubbles(
        bubblesGroup,
        filteredCountries,
        viewState.zoomScale,
        handleBubbleClick
    );
}

function updateWorldBubbles() {
    const currentYear = +document.getElementById('year-slider').value;

    const filterOptions = { year: currentYear, regions: activeRegions };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }
    const currentYearData = dataFilterManager.filter(filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    let filteredCountries = currentCountryData.filter(d =>
        activeRegions.includes(d.region) && d.coordinates
    );

    const maxCasualties = d3.max(filteredCountries, d => d.totalCasualties);
    const zoomFactor = viewState.zoomScale;
    const baseRange = [5 / zoomFactor, 40 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".conflict-bubble")
        .transition()
        .duration(100)
        .attr("r", d => radiusScale(d.totalCasualties));
}

function updateRegionBubbles() {
    if (!viewState.selectedRegion) return;

    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }
    const currentYearData = dataFilterManager.getRegionEvents(viewState.selectedRegion, filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    let filteredCountries = currentCountryData.filter(d => d.coordinates);

    const maxCasualties = d3.max(filteredCountries, d => d.totalCasualties);
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [5 / zoomFactor, 40 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".conflict-bubble")
        .transition()
        .duration(100)
        .attr("r", d => radiusScale(d.totalCasualties));

    updateStats();
}

// ============================================================================
// COUNTRY INTERACTIONS (From global.js + graph.js patterns)
// ============================================================================

function findCountryFeature(countryName) {
    const allCountryFeatures = mapGroup.selectAll(".country").data();

    const normalize = str => str.toLowerCase()
        .replace(/\bthe\b/g, '')
        .replace(/\brepublic of\b/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Try exact match
    let countryFeature = allCountryFeatures.find(c => c.properties.name === countryName);
    if (countryFeature) return countryFeature;

    // 2. Try normalized match
    const normalizedTarget = normalize(countryName);
    countryFeature = allCountryFeatures.find(c => normalize(c.properties.name) === normalizedTarget);
    if (countryFeature) return countryFeature;

    // 3. Manual mapping
    const manualMapping = {
        "DR Congo (Zaire)": "Dem. Rep. Congo",
        "Myanmar (Burma)": "Myanmar",
        "South Sudan": "S. Sudan",
        "Bosnia-Herzegovina": "Bosnia and Herz.",
        "Ivory Coast": "Côte d'Ivoire",
        "Laos": "Lao PDR",
        "United States": "United States of America",
        "North Korea": "Dem. Rep. Korea",
        "South Korea": "Korea"
    };

    if (manualMapping[countryName]) {
        countryFeature = allCountryFeatures.find(c => c.properties.name === manualMapping[countryName]);
        if (countryFeature) return countryFeature;
    }

    return countryFeature;
}

function handleCountryClick(event, d) {
    event.stopPropagation();

    // If in event detail view, clicking on map exits to country view
    if (viewState.selectedEvent && (viewState.mode === 'event' || viewState.mode === 'country')) {
        viewState.selectedEvent = null;

        // Clear canvas bubble selection
        if (canvasBubbleRenderer.canvas) {
            canvasBubbleRenderer.clearSelection();
        }

        // Clear SVG bubble selection classes
        bubblesGroup.selectAll(".event-bubble")
            .classed("selected-event", false)
            .classed("unselected-event", false);

        // Ensure mode is country (not event)
        viewState.mode = 'country';

        // Refresh country view panels
        if (viewState.selectedCountryData) {
            updateAllCharts();
            updateCountryPanel();
        }
        return;
    }

    const countryName = d.properties.name;

    const countryConflictData = processedData.find(c =>
        c.name === countryName || findCountryFeature(c.name) === d
    );

    if (!countryConflictData) return;
    enterCountryView(d, countryConflictData.name, countryConflictData);
}

function handleBubbleClick(event, d) {
    event.stopPropagation();
    const countryName = d.name;
    const countryFeature = findCountryFeature(countryName);

    if (countryFeature) {
        enterCountryView(countryFeature, countryName, d);
    }
}

// ============================================================================
// COUNTRY VIEW (Logic from graph.js Faction View)
// ============================================================================

function enterCountryView(countryFeature, countryName, countryConflictData) {
    console.log('[DEBUG] enterCountryView called for:', countryName);
    viewState.previousMode = viewState.mode;
    viewState.mode = 'country';
    console.log('[DEBUG] viewState.mode set to:', viewState.mode);
    viewState.selectedCountryName = countryName;
    viewState.selectedCountryData = countryConflictData;
    viewState.selectedEvent = null;

    // Clear existing bubbles (SVG and Canvas)
    bubblesGroup.selectAll("*").remove();
    if (canvasBubbleRenderer.canvas) {
        canvasBubbleRenderer.clear();
    }

    // Hide decorations
    mapGroup.select(".sphere").style("opacity", 0).style("display", "none");
    mapGroup.select(".graticule").style("opacity", 0).style("display", "none");

    // Dim other countries (like graph.js)
    mapGroup.selectAll(".country")
        .style("display", "block")
        .transition()
        .duration(500)
        .style("opacity", country => {
            if (country.properties.name === countryFeature.properties.name) return 1;
            return 0.15;
        })
        .style("pointer-events", country => {
            return country.properties.name === countryFeature.properties.name ? "auto" : "none";
        });

    // Zoom to country
    zoomToCountry(countryFeature);

    // Draw individual event bubbles (like drawFactionBubbles in graph.js)
    setTimeout(() => {
        drawEventBubbles();
    }, 600);

    // Update left panel (like updateFactionPanel in graph.js)
    updateCountryPanel();

    // Show right panel with charts
    d3.select("#charts-panel").style("display", "flex");
    d3.select("#charts-title").text("Country Statistics");
    d3.select("#charts-subtitle").text(countryName);
    d3.select("#reset-zoom").style("display", "block");

    setTimeout(() => {
        updateAllCharts();
    }, 800);
}

function zoomToCountry(countryFeature) {
    const bounds = path.bounds(countryFeature);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    // Scale so country occupies ~2/3 of screen (0.67 factor)
    // Increased max scale to 50 for small countries to be clearly visible
    const scale = Math.max(1, Math.min(50, 0.67 / Math.max(dx / mapWidth, dy / mapHeight)));
    const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// ============================================================================
// EVENT BUBBLES (Logic from graph.js drawFactionBubbles)
// ============================================================================

function drawEventBubbles() {
    if (!viewState.selectedCountryData) return;

    const currentYear = +document.getElementById('year-slider').value;
    let events = viewState.selectedCountryData.eventsWithCoords || viewState.selectedCountryData.events || [];
    console.log('[DEBUG] drawEventBubbles - currentYear:', currentYear, 'total events before filter:', events.length);

    events = events.filter(e => e.year <= currentYear && e.latitude && e.longitude);
    console.log('[DEBUG] drawEventBubbles - events after year filter:', events.length);

    // Apply violence type filter
    if (viewState.selectedViolenceType) {
        events = events.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
    }

    // Apply faction filter
    if (viewState.selectedFaction) {
        events = events.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(viewState.selectedFaction) || sideB.includes(viewState.selectedFaction);
        });
    }

    // Clear SVG bubbles
    bubblesGroup.selectAll(".event-bubble").remove();

    if (events.length === 0) {
        canvasBubbleRenderer.clear();
        return;
    }

    const maxCasualties = d3.max(events, e => e.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([3 / zoomFactor, 20 / zoomFactor]);

    // ALWAYS destroy and reinitialize canvas to ensure correct projection
    const mapSection = document.querySelector('.map-section');

    // Destroy existing canvas
    if (canvasBubbleRenderer.canvas) {
        canvasBubbleRenderer.destroy();
    }

    // Reinitialize with current dimensions and projection
    canvasBubbleRenderer.initialize(mapSection, mapWidth, mapHeight, projection);

    // Set event handlers
    canvasBubbleRenderer.onClick = (event, bubble) => {
        selectEvent(bubble.data);
    };

    canvasBubbleRenderer.onHover = (event, bubble) => {
        showEventTooltip(event, bubble.data);
    };

    canvasBubbleRenderer.onHoverEnd = () => {
        hideEventTooltip();
    };

    // Handle click on empty canvas area - exit event detail view
    canvasBubbleRenderer.onEmptyClick = (event) => {
        if (viewState.selectedEvent) {
            viewState.selectedEvent = null;
            canvasBubbleRenderer.clearSelection();

            // Ensure mode is country (not event)
            viewState.mode = 'country';

            // Refresh country view panels
            if (viewState.selectedCountryData) {
                updateAllCharts();
                updateCountryPanel();
            }
        }
    };

    // Use progressive loading for large datasets (>500 events)
    console.log('[DEBUG] Setting canvas bubbles, count:', events.length);
    if (events.length > 500) {
        canvasBubbleRenderer.setBubblesProgressive(events, {
            type: 'event',
            radiusScale: radiusScale,
            colorFn: d => TYPE_COLORS[d.type_of_violence_name] || '#64748b'
        });
    } else {
        // Set bubbles using Canvas
        canvasBubbleRenderer.setBubbles(events, {
            type: 'event',
            radiusScale: radiusScale,
            colorFn: d => TYPE_COLORS[d.type_of_violence_name] || '#64748b'
        });
    }

    // Update transform to match current zoom
    if (viewState.zoomTransform) {
        canvasBubbleRenderer.updateTransform(viewState.zoomTransform);
    }
}

// Tooltip helpers for Canvas bubbles
function showEventTooltip(mouseEvent, eventData) {
    const tooltip = d3.select("body").selectAll(".canvas-tooltip").data([0])
        .join("div")
        .attr("class", "canvas-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(15, 23, 42, 0.95)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("max-width", "250px");

    tooltip
        .style("left", (mouseEvent.clientX + 10) + "px")
        .style("top", (mouseEvent.clientY - 10) + "px")
        .html(`
            <div style="font-weight: 600; margin-bottom: 4px;">${eventData.dyad_name || eventData.conflict_name}</div>
            <div>${eventData.year} • ${eventData.country}</div>
            <div style="color: ${TYPE_COLORS[eventData.type_of_violence_name] || '#64748b'};">${eventData.type_of_violence_name}</div>
            <div style="color: #ef4444; font-weight: 600;">${d3.format(",d")(eventData.best)} casualties</div>
        `);
}

function hideEventTooltip() {
    d3.select(".canvas-tooltip").remove();
}

function updateEventBubbleSizes() {
    // Canvas handles its own sizing through updateBubbleSizes
    if (canvasBubbleRenderer.canvas && canvasBubbleRenderer.bubbles.length > 0) {
        const currentYear = +document.getElementById('year-slider').value;
        let events = viewState.selectedCountryData?.eventsWithCoords || viewState.selectedCountryData?.events || [];
        events = events.filter(e => e.year <= currentYear && e.latitude && e.longitude);

        const maxCasualties = d3.max(events, e => e.best) || 1;
        const zoomFactor = viewState.zoomScale || 1;
        const radiusScale = d3.scaleSqrt()
            .domain([0, maxCasualties])
            .range([3 / zoomFactor, 20 / zoomFactor]);

        canvasBubbleRenderer.updateBubbleSizes(radiusScale);
    }

    // Fallback to SVG if still using SVG bubbles
    bubblesGroup.selectAll(".event-bubble")
        .transition()
        .duration(100)
        .attr("r", d => radiusScale(d.best));
}

function selectEvent(event) {
    const now = performance.now();
    if (now - lastEventSelectTime < 50) return;
    lastEventSelectTime = now;

    if (viewState.selectedEvent === event) return;

    viewState.selectedEvent = event;

    // Update canvas bubble selection
    if (canvasBubbleRenderer.canvas) {
        canvasBubbleRenderer.selectBubble(event);
    }

    requestAnimationFrame(() => {
        bubblesGroup.selectAll(".event-bubble")
            .classed("selected-event", d => d === event)
            .classed("unselected-event", d => d !== event);
    });

    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            renderEventDetailsView(event);
        }, { timeout: 100 });
    } else {
        setTimeout(() => {
            requestAnimationFrame(() => {
                renderEventDetailsView(event);
            });
        }, 16);
    }
}

// ============================================================================
// LEFT PANEL - COUNTRY VIEW (Logic from graph.js updateFactionPanel)
// ============================================================================

function updateCountryPanel() {
    if (!viewState.selectedCountryData) return;

    const data = viewState.selectedCountryData;
    const currentYear = +document.getElementById('year-slider').value;
    let filteredEvents = data.events ? data.events.filter(e => e.year <= currentYear) : [];

    // Apply filters
    if (viewState.selectedViolenceType) {
        filteredEvents = filteredEvents.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
    }
    if (viewState.selectedFaction) {
        filteredEvents = filteredEvents.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(viewState.selectedFaction) || sideB.includes(viewState.selectedFaction);
        });
    }

    const leftPanel = d3.select("#left-panel");

    // Hide default sections
    d3.select(".legend-section").style("display", "none");
    d3.select(".stats-container").style("display", "none");
    d3.select(".violence-filter-section").style("display", "none");

    // Remove previous panels
    leftPanel.select("#country-panel").remove();

    const region = data.region || 'Unknown';
    const casualties = d3.sum(filteredEvents, e => e.best);

    // Create panel (like updateFactionPanel in graph.js)
    const countryPanel = leftPanel.insert("div", ".reset-btn")
        .attr("id", "country-panel")
        .style("padding", "1.5rem")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)")
        .style("border-radius", "8px")
        .style("margin-bottom", "1rem")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    // Title
    countryPanel.append("h3")
        .style("margin", "0 0 1rem 0")
        .style("font-size", "1.2rem")
        .style("color", "#1e293b")
        .style("border-bottom", "2px solid #cbd5e1")
        .style("padding-bottom", "0.5rem")
        .text("Country Details");

    // Country name box
    countryPanel.append("div")
        .style("margin-bottom", "1rem")
        .style("padding", "0.75rem")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("border-left", `4px solid ${REGION_COLORS[region] || "#64748b"}`)
        .html(`
            <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${viewState.selectedCountryName}</div>
            <div style="font-size: 0.85rem; color: #64748b;">${region}</div>
        `);

    // Stats grid (2x2)
    const statsGrid = countryPanel.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "1fr 1fr")
        .style("gap", "0.75rem")
        .style("margin-bottom", "1rem");

    // Region stat
    const regionStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    regionStat.append("div").style("font-size", "0.75rem").style("color", "#94a3b8").text("Region");
    regionStat.append("div").style("font-weight", "600").style("color", REGION_COLORS[region] || "#64748b").text(region);

    // Events stat
    const eventsStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    eventsStat.append("div").style("font-size", "0.75rem").style("color", "#94a3b8").text("Events");
    eventsStat.append("div").style("font-weight", "700").style("color", "#3b82f6").text(d3.format(",d")(filteredEvents.length));

    // Casualties stat
    const casualtiesStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    casualtiesStat.append("div").style("font-size", "0.75rem").style("color", "#94a3b8").text("Casualties");
    casualtiesStat.append("div").style("font-weight", "700").style("color", "#ef4444").text(d3.format(",d")(casualties));

    // Factions count
    const factionSet = new Set();
    filteredEvents.forEach(e => {
        if (e.side_a) factionSet.add(e.side_a);
        if (e.side_b) factionSet.add(e.side_b);
    });
    const factionsStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    factionsStat.append("div").style("font-size", "0.75rem").style("color", "#94a3b8").text("Factions");
    factionsStat.append("div").style("font-weight", "700").style("color", "#8b5cf6").text(factionSet.size);

    // Activity Period
    if (filteredEvents.length > 0) {
        const years = filteredEvents.map(e => e.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const periodStat = statsGrid.append("div")
            .style("background", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "6px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)")
            .style("grid-column", "1 / -1");
        periodStat.append("div").style("font-size", "0.75rem").style("color", "#94a3b8").text("Activity Period");
        periodStat.append("div").style("font-weight", "600").style("color", "#64748b").text(`${minYear} - ${maxYear} (${maxYear - minYear + 1} years)`);
    }

    // Violence Type Distribution
    if (filteredEvents.length > 0) {
        const violenceTypes = d3.rollup(
            filteredEvents,
            v => ({ count: v.length, casualties: d3.sum(v, e => e.best) }),
            d => d.type_of_violence_name
        );

        countryPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Violence Type Distribution");

        const violenceContainer = countryPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem");

        const sortedTypes = Array.from(violenceTypes.entries())
            .sort((a, b) => b[1].casualties - a[1].casualties);

        const maxCasualties = d3.max(sortedTypes, d => d[1].casualties);

        sortedTypes.forEach(([type, typeData]) => {
            const percentage = (typeData.casualties / maxCasualties) * 100;

            const typeRow = violenceContainer.append("div").style("margin-bottom", "0.5rem");
            typeRow.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("font-size", "0.75rem")
                .style("margin-bottom", "0.25rem")
                .html(`
                    <span style="color: #475569; font-weight: 500;">${type}</span>
                    <span style="color: #ef4444; font-weight: 600;">${d3.format(",d")(typeData.casualties)}</span>
                `);

            typeRow.append("div")
                .style("height", "6px")
                .style("background", "#e2e8f0")
                .style("border-radius", "3px")
                .style("overflow", "hidden")
                .append("div")
                .style("width", `${percentage}%`)
                .style("height", "100%")
                .style("background", TYPE_COLORS[type] || "#64748b");
        });
    }

    // Activity by Year Heatmap (like graph.js faction view)
    if (filteredEvents.length > 0) {
        countryPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Activity by Year");

        const heatmapContainer = countryPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem");

        const yearData = d3.rollup(filteredEvents, v => d3.sum(v, e => e.best), d => d.year);
        const years = Array.from(yearData.keys()).sort((a, b) => a - b);
        const maxCas = d3.max(Array.from(yearData.values()));

        const heatmapSvg = heatmapContainer.append("svg")
            .attr("width", "100%")
            .attr("height", 60);

        const cellWidth = Math.max(8, Math.min(15, 280 / years.length));

        years.forEach((year, i) => {
            const intensity = yearData.get(year) / maxCas;
            heatmapSvg.append("rect")
                .attr("x", i * (cellWidth + 2))
                .attr("y", 10)
                .attr("width", cellWidth)
                .attr("height", 30)
                .attr("fill", d3.interpolateReds(intensity))
                .attr("rx", 2)
                .append("title").text(`${year}: ${d3.format(",d")(yearData.get(year))} casualties`);
        });

        // Year labels (every 3 years)
        years.filter(y => y % 3 === 0).forEach((year) => {
            const idx = years.indexOf(year);
            if (idx >= 0) {
                heatmapSvg.append("text")
                    .attr("x", idx * (cellWidth + 2) + cellWidth / 2)
                    .attr("y", 55)
                    .attr("text-anchor", "middle")
                    .style("font-size", "9px")
                    .style("fill", "#64748b")
                    .text(year);
            }
        });
    }

    // Connected Factions (clickable to filter) - show EVENTS count
    const factionEventCounts = {};
    filteredEvents.forEach(event => {
        if (event.side_a) {
            if (!factionEventCounts[event.side_a]) factionEventCounts[event.side_a] = { events: 0, isAlly: true };
            factionEventCounts[event.side_a].events++;
        }
        if (event.side_b) {
            if (!factionEventCounts[event.side_b]) factionEventCounts[event.side_b] = { events: 0, isAlly: false };
            factionEventCounts[event.side_b].events++;
        }
    });

    const connectedFactions = Object.entries(factionEventCounts)
        .map(([name, fData]) => ({ name, events: fData.events, isAlly: fData.isAlly }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 10);

    if (connectedFactions.length > 0) {
        countryPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Connected Factions (Click to Filter)");

        const factionsContainer = countryPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem");

        connectedFactions.forEach(faction => {
            const isSelected = viewState.selectedFaction === faction.name;

            // Determine color: black when no filter, green for ally, red for opponent when filter applied
            let numberColor = "#1e293b"; // Default black
            if (viewState.selectedFaction) {
                numberColor = faction.isAlly ? "#22c55e" : "#ef4444";
            }

            factionsContainer.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("padding", "0.4rem 0.5rem")
                .style("font-size", "0.75rem")
                .style("border-bottom", "1px solid #f1f5f9")
                .style("cursor", "pointer")
                .style("background", isSelected ? "#fef2f2" : "transparent")
                .style("border-left", isSelected ? "3px solid #ef4444" : "none")
                .on("mouseover", function () { d3.select(this).style("background", "#f1f5f9"); })
                .on("mouseout", function () { d3.select(this).style("background", isSelected ? "#fef2f2" : "transparent"); })
                .on("click", () => {
                    viewState.selectedFaction = isSelected ? null : faction.name;
                    updateCountryPanel();
                    drawEventBubbles();
                    updateAllCharts();
                })
                .html(`
                    <span style="color: ${isSelected ? '#ef4444' : '#475569'}; font-weight: ${isSelected ? '600' : '400'};">${faction.name}</span>
                    <span style="color: ${numberColor}; font-weight: 600;">${d3.format(",d")(faction.events)}</span>
                `);
        });
    }

    // Faction filter reset button
    if (viewState.selectedFaction) {
        countryPanel.append("button")
            .style("width", "100%")
            .style("padding", "0.5rem 1rem")
            .style("margin-top", "1rem")
            .style("background", "#ef4444")
            .style("color", "white")
            .style("border", "none")
            .style("border-radius", "6px")
            .style("cursor", "pointer")
            .style("font-weight", "600")
            .text(`✕ Clear Filter: ${viewState.selectedFaction}`)
            .on("click", () => {
                viewState.selectedFaction = null;
                updateCountryPanel();
                drawEventBubbles();
                updateAllCharts();
            });
    }
}

function resetLeftPanel() {
    d3.select("#country-panel").remove();
    d3.select(".legend-section").style("display", "block");
    d3.select(".stats-container").style("display", "block");
    d3.select(".violence-filter-section").style("display", "block");
    updateStats();
}

// ============================================================================
// RIGHT PANEL CHARTS (INLINED from shared.js - NO external calls)
// ============================================================================

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

function renderActivityHeatmap(container, events, title = "Activity Timeline") {
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
        .style("overflow", "hidden"); // Changed from overflow-x: auto to hidden for proper fitting

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const yearMonthData = d3.rollup(
        events.filter(e => e.month),
        v => d3.sum(v, e => e.best),
        d => d.year,
        d => d.month
    );

    const years = Array.from(new Set(events.map(e => e.year))).sort((a, b) => a - b);

    let maxCellCasualties = 0;
    yearMonthData.forEach(monthMap => {
        monthMap.forEach(casualties => {
            if (casualties > maxCellCasualties) maxCellCasualties = casualties;
        });
    });
    if (maxCellCasualties === 0) maxCellCasualties = 1;

    // Get actual container width
    const containerWidth = heatmapContainer.node()?.getBoundingClientRect().width || 280;
    const containerHeight = 180; // Fixed height for heatmap area

    const margin = { top: 5, right: 5, bottom: 20, left: 30 };
    const availableWidth = containerWidth - margin.left - margin.right;
    const availableHeight = containerHeight - margin.top - margin.bottom;

    // Calculate cell sizes to fit within available space
    const numYears = Math.max(years.length, 1);
    const cellGap = 1;

    // Calculate cell width and height to fit perfectly
    const cellWidth = Math.max(3, (availableWidth - (numYears - 1) * cellGap) / numYears);
    const cellHeight = Math.max(8, (availableHeight - 11 * cellGap) / 12);

    // Calculate actual SVG dimensions based on cells
    const heatmapWidth = margin.left + numYears * (cellWidth + cellGap) + margin.right;
    const heatmapHeight = margin.top + 12 * (cellHeight + cellGap) + margin.bottom;

    const heatmapSvg = heatmapContainer.append("svg")
        .attr("width", "100%")
        .attr("height", containerHeight)
        .attr("viewBox", `0 0 ${heatmapWidth} ${heatmapHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Month labels (Y-axis)
    monthNames.forEach((month, monthIdx) => {
        heatmapSvg.append("text")
            .attr("x", margin.left - 3)
            .attr("y", margin.top + monthIdx * (cellHeight + cellGap) + cellHeight / 2 + 3)
            .attr("text-anchor", "end")
            .style("font-size", `${Math.max(6, Math.min(9, cellHeight * 0.8))}px`)
            .style("fill", "#64748b")
            .text(month);
    });

    // Draw heatmap cells
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

    // Year labels (X-axis) - show enough labels to be readable
    const maxLabels = Math.floor(availableWidth / 25); // ~25px per label minimum
    const yearLabelInterval = Math.max(1, Math.ceil(years.length / maxLabels));

    years.filter((y, i) => i % yearLabelInterval === 0 || i === years.length - 1).forEach((year) => {
        const idx = years.indexOf(year);
        heatmapSvg.append("text")
            .attr("x", margin.left + idx * (cellWidth + cellGap) + cellWidth / 2)
            .attr("y", margin.top + 12 * (cellHeight + cellGap) + 12)
            .attr("text-anchor", "middle")
            .style("font-size", `${Math.max(6, Math.min(9, cellWidth * 0.9))}px`)
            .style("fill", "#64748b")
            .text(year);
    });

    return heatmapContainer;
}

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

function renderEventsList(container, events, options = {}) {
    if (!events || events.length === 0) return;

    const { title = "Most Severe Events", limit = 15, onClick = null } = options;

    const eventsSection = container.append("div")
        .attr("class", "chart-container")
        .style("margin-top", "1rem");

    eventsSection.append("h4")
        .style("margin", "0 0 0.5rem 0")
        .style("font-size", "0.9rem")
        .style("color", "#475569")
        .text(title);

    const listContainer = eventsSection.append("div")
        .attr("class", "events-list");

    const sortedEvents = [...events].sort((a, b) => b.best - a.best).slice(0, limit);

    sortedEvents.forEach((event, idx) => {
        const item = listContainer.append("div")
            .attr("class", "event-item")
            .style("border-left-color", TYPE_COLORS[event.type_of_violence_name] || '#64748b')
            .style("cursor", onClick ? "pointer" : "default")
            .on("click", () => { if (onClick) onClick(event); });

        // Title: index + dyad_name (like faction view)
        item.append("div")
            .attr("class", "event-item-title")
            .text(`${idx + 1}. ${event.dyad_name || event.country + ' Conflict'}`);

        // Meta: year + casualties (red) + violence type
        item.append("div")
            .attr("class", "event-item-meta")
            .html(`${event.year} • <strong style="color: #ef4444;">${d3.format(",d")(event.best)} casualties</strong> • ${event.type_of_violence_name}`);
    });

    return listContainer;
}

// INLINED updateDashboardUI - builds Right Panel like Graph View (ảnh 2)
// Structure: Casualties Over Time (line chart) + Conflicts with Connected Factions (bar chart) + Most Severe Events
function updateDashboardUILocal(events, title, subtitle, onEventClick) {
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // Header
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

    // Chart 1: Conflict Trends Over Time (Dual-axis: Line Chart + Bar Chart)
    const timelineContainer = chartsPanel.append("div")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem")
        .style("width", "100%");
    timelineContainer.append("h4").style("margin", "0 0 10px 0").text("Conflict Trends Over Time");
    const timelineSvg = timelineContainer.append("svg")
        .attr("id", "country-chart-timeline")
        .attr("class", "stat-chart")
        .attr("viewBox", "0 0 400 200")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto")
        .style("min-height", "180px");
    renderTimelineChart(events, timelineSvg);

    // Chart 2: Conflicts with Connected Factions (Active Factions Bar Chart)
    const connContainer = chartsPanel.append("div")
        .attr("id", "faction-connected-chart-container")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem");
    connContainer.append("h4").style("margin", "0 0 10px 0").text("Conflicts with Connected Factions");
    const connChartDiv = connContainer.append("div")
        .attr("id", "faction-connected-chart");
    renderConnectedFactionsBarChart(events, connChartDiv);

    // Chart 3: Most Severe Events
    renderEventsList(chartsPanel, events, {
        title: "Most Severe Events",
        limit: 20,
        onClick: onEventClick
    });
}

// Render DUAL-AXIS chart: Casualties (line) + Events Count (bars) by Year
function renderTimelineChart(events, svg) {
    const width = 400, height = 200;
    const margin = { top: 25, right: 50, bottom: 30, left: 50 };
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
// When no faction filter: show neutral blue bars
// When faction filter applied: show ally (green) / opponent (red)
function renderConnectedFactionsBarChart(events, container) {
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
    const hasFilter = !!viewState.selectedFaction;

    // Horizontal bar list
    const barList = container.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "0.5rem");

    topFactions.forEach(faction => {
        const isSelected = viewState.selectedFaction === faction.id;

        // Determine colors based on filter state
        let barColor = "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)"; // Neutral blue
        let labelColor = "";
        let labelText = "";

        if (hasFilter) {
            // When filtered: show ally/opponent
            if (faction.isOpponent) {
                barColor = "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)";
                labelColor = "#ef4444";
                labelText = "Opponent";
            } else {
                barColor = "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)";
                labelColor = "#22c55e";
                labelText = "Ally";
            }
        }

        const barRow = barList.append("div")
            .attr("class", "conn-faction-bar-row")
            .style("cursor", "pointer")
            .style("padding", "0.5rem")
            .style("background", isSelected ? "#dbeafe" : "#f8fafc")
            .style("border-radius", "6px")
            .style("transition", "all 0.2s ease")
            .on("mouseenter", function () {
                d3.select(this).style("background", "#e0e7ff");
            })
            .on("mouseleave", function () {
                d3.select(this).style("background", isSelected ? "#dbeafe" : "#f8fafc");
            })
            .on("click", function () {
                // Filter by faction
                viewState.selectedFaction = viewState.selectedFaction === faction.id ? null : faction.id;
                updateCountryPanel();
                drawEventBubbles();
                updateAllCharts();
            });

        // Faction name row
        const nameRow = barRow.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.25rem");

        nameRow.append("span")
            .style("font-size", "0.8rem")
            .style("font-weight", "600")
            .style("color", "#1e293b")
            .text(faction.id.length > 35 ? faction.id.substring(0, 32) + '...' : faction.id);

        // Only show ally/opponent label when filter is applied
        if (hasFilter && labelText) {
            nameRow.append("span")
                .style("font-size", "0.8rem")
                .style("color", labelColor)
                .style("font-weight", "600")
                .text(labelText);
        }

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
            .style("background", barColor)
            .style("border-radius", "6px");

        // Casualty number
        barRow.append("div")
            .style("font-size", "0.7rem")
            .style("color", "#64748b")
            .style("margin-top", "0.15rem")
            .text(`${d3.format(",d")(faction.casualties)} casualties`);
    });

    // Legend - only show when filter is applied
    if (hasFilter) {
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
}


// INLINED renderEntityInfoPanel - builds Event Details like in ảnh 2
function renderEntityInfoPanelLocal(container, options) {
    const {
        title = "Details",
        entityName = "",
        entitySubtext = "",
        entityColor = "#64748b",
        events = [],
        country = null,
        region = null,
        connectedEntities = [],
        connectedTitle = "Connected Factions"
    } = options;

    container.html("");

    const panel = container.append("div")
        .style("padding", "1.5rem")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)")
        .style("border-radius", "8px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    panel.append("h3")
        .style("margin", "0 0 1rem 0")
        .style("font-size", "1.2rem")
        .style("color", "#1e293b")
        .style("border-bottom", "2px solid #cbd5e1")
        .style("padding-bottom", "0.5rem")
        .text(title);

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

    // Connected entities (Factions Involved) like in ảnh 2
    if (connectedEntities.length > 0) {
        panel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text(`${connectedTitle} (${connectedEntities.length})`);

        const listContainer = panel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem");

        connectedEntities.forEach(entity => {
            const item = listContainer.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("align-items", "center")
                .style("padding", "0.5rem")
                .style("margin-bottom", "0.25rem")
                .style("background", "#f8fafc")
                .style("border-radius", "4px");

            const leftDiv = item.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "0.5rem");

            if (entity.color) {
                leftDiv.append("div")
                    .style("width", "8px")
                    .style("height", "8px")
                    .style("border-radius", "50%")
                    .style("background", entity.color);
            }

            leftDiv.append("span")
                .style("font-size", "0.8rem")
                .style("color", "#475569")
                .style("font-weight", "500")
                .text(entity.name);

            if (entity.casualties !== undefined) {
                item.append("span")
                    .style("font-size", "0.75rem")
                    .style("color", "#ef4444")
                    .style("font-weight", "600")
                    .text(d3.format(",d")(entity.casualties));
            }
        });
    }

    return panel;
}

// ============================================================================
// RIGHT PANEL - EVENT DETAILS (INLINED - like in ảnh 2)
// ============================================================================

function renderEventDetailsView(event) {
    if (!event) return;

    viewState.mode = 'event';

    // Show right panel if hidden
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // Header
    chartsPanel.append("div")
        .attr("class", "charts-header")
        .html(`
            <h3 id="charts-title" style="margin: 0 0 5px 0; font-size: 18px;">Event Details</h3>
            <p style="margin: 0; font-size: 14px; color: #64748b;">${event.dyad_name || "Conflict Event"}</p>
        `);

    // Container for details
    const detailsContainer = chartsPanel.append("div")
        .attr("id", "event-text-details")
        .attr("class", "chart-container")
        .style("display", "block");

    // Build HTML string matching graph.js renderFactionEventDetails format exactly
    const detailsHTML = `
        <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(0, 0, 0, 0.05);">
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                ${event.date_start || event.year} • ${event.type_of_violence_name}
            </div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.3;">
                ${event.dyad_name || 'Unknown Conflict Event'}
            </div>
            ${event.where_description ? `
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
                <strong>Location:</strong> ${event.where_description}
            </div>
            ` : ''}
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <div style="padding: 1rem; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%); border-radius: 8px; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                    Total Casualties
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: #ef4444; line-height: 1;">
                    ${d3.format(",d")(event.best)}
                </div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                    Best Estimate
                </div>
            </div>
        </div>
        
        <div style="padding: 1.25rem; background: rgba(0, 0, 0, 0.02); border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(0, 0, 0, 0.05);">
            <h4 style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 1rem;">
                Casualties Breakdown by Group
            </h4>
            
            <!-- Visual Bar Chart -->
            <div id="casualties-bar-chart" style="margin-bottom: 1rem; height: 30px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex;">
                ${event.deaths_a > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); width: ${(event.deaths_a / event.best * 100)}%;" title="Side A: ${d3.format(",d")(event.deaths_a)} (${d3.format(".1%")(event.deaths_a / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); width: ${(event.deaths_b / event.best * 100)}%;" title="Side B: ${d3.format(",d")(event.deaths_b)} (${d3.format(".1%")(event.deaths_b / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_civilians > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); width: ${(event.deaths_civilians / event.best * 100)}%;" title="Civilians: ${d3.format(",d")(event.deaths_civilians)} (${d3.format(".1%")(event.deaths_civilians / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_unknown > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #57534e 0%, #78716c 100%); width: ${(event.deaths_unknown / event.best * 100)}%;" title="Unknown: ${d3.format(",d")(event.deaths_unknown)} (${d3.format(".1%")(event.deaths_unknown / event.best)})">
                </div>
                ` : ''}
            </div>
            
            <!-- Detailed Breakdown List -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${event.deaths_a > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #ef4444;">
                    <span style="font-size: 0.8rem; color: #475569;">Side A: ${event.side_a || 'Unknown'}</span>
                    <span style="font-weight: 600; color: #ef4444;">${d3.format(",d")(event.deaths_a)}</span>
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
                    <span style="font-size: 0.8rem; color: #475569;">Side B: ${event.side_b || 'Unknown'}</span>
                    <span style="font-weight: 600; color: #3b82f6;">${d3.format(",d")(event.deaths_b)}</span>
                </div>
                ` : ''}
                ${event.deaths_civilians > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #22c55e;">
                    <span style="font-size: 0.8rem; color: #475569;">Civilians</span>
                    <span style="font-weight: 600; color: #16a34a;">${d3.format(",d")(event.deaths_civilians)}</span>
                </div>
                ` : ''}
                ${event.deaths_unknown > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #78716c;">
                    <span style="font-size: 0.8rem; color: #475569;">Unknown</span>
                    <span style="font-weight: 600; color: #78716c;">${d3.format(",d")(event.deaths_unknown)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${event.source_headline || event.source_article ? `
        <div style="padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; margin-top: 1rem; border: 1px solid rgba(59, 130, 246, 0.1);">
            <h4 style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem;">
                Source Information
            </h4>
            ${event.source_headline ? `<p style="font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem; font-style: italic; line-height: 1.5;">"${event.source_headline}"</p>` : ''}
            ${event.source_article ? `<p style="font-size: 0.75rem; color: #94a3b8; line-height: 1.4;">${event.source_article}</p>` : ''}
        </div>
        ` : ''}
    `;

    detailsContainer.html(detailsHTML);
}

// ============================================================================
// CHARTS (INLINED - calls local functions instead of shared.js)
// ============================================================================

function updateAllCharts() {
    if (viewState.mode === 'world') {
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        const currentYear = +document.getElementById('year-slider').value;
        let events = viewState.selectedCountryData?.events?.filter(e => e.year <= currentYear) || [];

        if (viewState.selectedViolenceType) {
            events = events.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
        }
        if (viewState.selectedFaction) {
            events = events.filter(e => {
                const sideA = e.side_a || '';
                const sideB = e.side_b || '';
                return sideA.includes(viewState.selectedFaction) || sideB.includes(viewState.selectedFaction);
            });
        }

        const countryName = viewState.selectedCountryName || 'Country';
        const region = viewState.selectedCountryData?.region || '';
        updateDashboardUILocal(events, `Statistics: ${countryName}`, region, selectEvent);
    } else if (viewState.mode === 'event') {
        renderEventDetailsView(viewState.selectedEvent);
    }
}

// Store current sort mode for countries
let countrySortMode = 'casualties';

function renderTopCountriesList() {
    const container = d3.select("#charts-panel");
    container.style("display", "flex");

    // Update header based on sort mode
    const sortLabels = {
        'casualties': 'Casualties',
        'conflicts': 'Conflicts',
        'average': 'Avg Casualties'
    };
    d3.select("#charts-title").text(`Top Countries by ${sortLabels[countrySortMode]}`);
    d3.select("#charts-subtitle").text("Click to view country details");

    container.selectAll(".chart-container").style("display", "none");

    let listContainer = container.select("#top-countries-list");
    if (listContainer.empty()) {
        listContainer = container.append("div")
            .attr("id", "top-countries-list")
            .attr("class", "chart-container")
            .style("display", "block");

        listContainer.append("div").attr("class", "events-list");
    } else {
        listContainer.style("display", "block");
    }

    // Only show sort controls in world view
    const isWorldView = viewState.mode === 'world';
    let sortControls = listContainer.select("#country-sort-controls");

    if (!isWorldView) {
        if (!sortControls.empty()) {
            sortControls.style("display", "none");
        }
    } else {
        if (sortControls.empty()) {
            sortControls = listContainer.insert("div", ".events-list")
                .attr("id", "country-sort-controls")
                .attr("class", "sort-controls")
                .style("display", "flex")
                .style("gap", "10px")
                .style("margin-bottom", "10px");

            const modes = [
                { id: 'casualties', label: 'Casualties' },
                { id: 'conflicts', label: 'Conflicts' },
                { id: 'average', label: 'Average' }
            ];

            modes.forEach(mode => {
                sortControls.append("button")
                    .attr("class", "sort-btn")
                    .attr("data-mode", mode.id)
                    .text(mode.label)
                    .style("padding", "5px 10px")
                    .style("border-radius", "4px")
                    .style("border", "none")
                    .style("cursor", "pointer")
                    .style("background", countrySortMode === mode.id ? "#2563eb" : "#334155")
                    .style("color", "white")
                    .style("font-size", "0.75rem")
                    .on("click", function () {
                        countrySortMode = mode.id;
                        sortControls.selectAll(".sort-btn")
                            .style("background", function () {
                                return this.getAttribute("data-mode") === countrySortMode ? "#2563eb" : "#334155";
                            });
                        renderTopCountriesList();
                    });
            });
        } else {
            sortControls.style("display", "flex");
        }
    }

    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear, regions: activeRegions };

    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    const filteredData = dataFilterManager.filter(filterOptions);
    const countryStats = aggregationManager.aggregateByCountry(filteredData, countryData);

    // Sort based on current mode
    let sortedCountries;
    if (countrySortMode === 'casualties') {
        sortedCountries = [...countryStats].sort((a, b) => b.totalCasualties - a.totalCasualties);
    } else if (countrySortMode === 'conflicts') {
        sortedCountries = [...countryStats].sort((a, b) => b.totalEvents - a.totalEvents);
    } else {
        sortedCountries = [...countryStats].sort((a, b) => {
            const avgA = a.totalEvents > 0 ? a.totalCasualties / a.totalEvents : 0;
            const avgB = b.totalEvents > 0 ? b.totalCasualties / b.totalEvents : 0;
            return avgB - avgA;
        });
    }

    const topCountries = sortedCountries.slice(0, 15);

    const list = listContainer.select(".events-list");
    list.selectAll("*").remove();

    topCountries.forEach((country, idx) => {
        const item = list.append("div")
            .attr("class", "event-item")
            .style("cursor", "pointer")
            .style("border-left-color", REGION_COLORS[country.region])
            .on("click", () => {
                const countryFeature = findCountryFeature(country.name);
                if (countryFeature) {
                    enterCountryView(countryFeature, country.name, country);
                }
            });

        item.append("div")
            .attr("class", "event-item-title")
            .text(`${idx + 1}. ${country.name}`);

        item.append("div")
            .attr("class", "event-item-meta")
            .html(`<span style="color: ${REGION_COLORS[country.region]};">${country.region}</span> • 
                   <strong style="color: #ef4444;">${d3.format(",d")(country.totalCasualties)}</strong> casualties • 
                   ${d3.format(",d")(country.totalEvents)} events`);
    });
}


// ============================================================================
// UI SETUP (From global.js)
// ============================================================================

// Track if time slider has been initialized to prevent duplicate listeners
let timeSliderInitialized = false;

function createTimeSlider() {
    const slider = document.getElementById('year-slider');
    if (!slider || timeSliderInitialized) return;

    timeSliderInitialized = true;
    console.log('[DEBUG] Time slider initialized');

    slider.addEventListener('input', function () {
        const year = +this.value;
        console.log('[DEBUG] Slider input event fired - year:', year, 'mode:', viewState.mode);
        document.getElementById('year-current').textContent = year;
        updateMapForYear();
    });

    // Play button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        let playing = false;
        let interval = null;

        playBtn.addEventListener('click', function () {
            console.log('[DEBUG] Play button clicked - playing:', playing, 'mode:', viewState.mode);
            if (playing) {
                clearInterval(interval);
                interval = null;
                this.textContent = '▶ Play';
                playing = false;
            } else {
                this.textContent = '⏸ Pause';
                playing = true;

                interval = setInterval(() => {
                    const currentVal = +slider.value;
                    const maxVal = +slider.max;
                    console.log('[DEBUG] Play interval tick - year:', currentVal, 'mode:', viewState.mode);

                    if (currentVal >= maxVal) {
                        slider.value = slider.min;
                    } else {
                        slider.value = currentVal + 1;
                    }

                    document.getElementById('year-current').textContent = slider.value;
                    updateMapForYear();
                }, 500);
            }
        });
    }
}

function updateMapForYear() {
    console.log('[DEBUG] updateMapForYear called, mode:', viewState.mode);
    updateStats();
    if (viewState.mode === 'world') {
        drawConflictBubbles();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        console.log('[DEBUG] Calling drawEventBubbles for country mode');
        drawEventBubbles();
        updateCountryPanel();
        updateAllCharts();
    }
}

function setupModal() {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function setupBackButton() {
    const resetBtn = document.getElementById('reset-zoom');
    if (!resetBtn) return;

    resetBtn.onclick = () => {
        navigateBack();
    };
}

function setupViewToggle() {
    // View toggle is handled by HTML links
}

function createLegend() {
    const legendContainer = d3.select("#legend");
    legendContainer.selectAll("*").remove();

    Object.entries(REGION_COLORS).forEach(([region, color]) => {
        const item = legendContainer.append("div")
            .attr("class", "legend-item active")
            .attr("data-region", region)
            .on("click", function () {
                toggleRegion(region);
            });

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("span").text(region);
    });
}

function toggleRegion(region) {
    const legendContainer = d3.select("#legend");

    // If clicking the same region again, deselect and return to world view
    if (viewState.selectedRegion === region) {
        // Deselect - show all regions
        viewState.selectedRegion = null;
        activeRegions = Object.keys(REGION_COLORS);
        viewState.mode = 'world';

        // Reset zoom
        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity);

        // Update legend: all items active
        legendContainer.selectAll(".legend-item")
            .classed("active", true)
            .classed("selected", false);

        // Hide back button
        d3.select("#reset-zoom").style("display", "none");
    } else {
        // Select this region only
        viewState.selectedRegion = region;
        activeRegions = [region];
        viewState.mode = 'region';

        // Zoom to region
        zoomToRegion(region);

        // Update legend: only clicked item is active and selected
        legendContainer.selectAll(".legend-item")
            .classed("active", function () {
                return d3.select(this).attr("data-region") === region;
            })
            .classed("selected", function () {
                return d3.select(this).attr("data-region") === region;
            });

        // Show back button
        d3.select("#reset-zoom").style("display", "block");
    }

    // Refresh view
    drawConflictBubbles();
    updateStats();
    renderTopCountriesList();
}

function zoomToRegion(regionName) {
    if (!regionName || !worldMapFeatures) return;

    // Find all countries in this region
    const regionCountries = processedData
        .filter(d => d.region === regionName)
        .map(d => d.name);

    // Find corresponding map features
    const features = worldMapFeatures.filter(f => {
        const mapName = f.properties.name;
        if (regionCountries.includes(mapName)) return true;
        return regionCountries.some(c => {
            if (c === mapName) return true;
            if (COUNTRY_NAME_MAPPING && COUNTRY_NAME_MAPPING[c] === mapName) return true;
            return false;
        });
    });

    if (features.length === 0) return;

    // Calculate bounds of the collection of features
    const bounds = d3.geoPath().projection(projection).bounds({
        type: "FeatureCollection",
        features: features
    });

    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    const scale = Math.max(1, Math.min(20, 0.9 / Math.max(dx / mapWidth, dy / mapHeight)));
    const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );

    viewState.zoomScale = scale;
}

function createViolenceTypeFilter() {
    const filterContainer = document.getElementById('violence-type-filter');
    if (!filterContainer) return;

    filterContainer.innerHTML = '';
    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color" style="background: ${color};"></div>
            <span>${type}</span>
        `;
        item.onclick = () => {
            viewState.selectedViolenceType = viewState.selectedViolenceType === type ? null : type;

            filterContainer.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active'));
            if (viewState.selectedViolenceType) {
                item.classList.add('active');
            }

            if (viewState.mode === 'world') {
                drawConflictBubbles();
            } else if (viewState.mode === 'country') {
                drawEventBubbles();
                updateCountryPanel();
                updateAllCharts();
            }
            updateStats();
        };
        filterContainer.appendChild(item);
    });
}

function drawRegionalStackedBars(data) {
    // Implementation for regional stacked bars
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    initializeMap();
    await drawWorldMap();
    await loadData();
    drawConflictBubbles();

    // Initialize right panel with Top Countries List for World View
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // Header for right panel
    chartsPanel.append("div")
        .attr("class", "charts-header")
        .html(`
            <h3 id="charts-title" style="margin: 0 0 5px 0; font-size: 18px;">Top Countries by Casualties</h3>
            <p id="charts-subtitle" style="margin: 0; font-size: 14px; color: #64748b;">Click to view country details</p>
        `);

    renderTopCountriesList();
});
