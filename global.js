// ============================================================================
// GLOBAL CONFLICT MAP VISUALIZATION - MAP VIEW (CLEAN SLATE REFACTOR)
// Unified UI/UX with Graph View - Uses shared modules
// ============================================================================

// === GLOBAL STATE ===
let rawData = [];
let processedData = [];
let countryData = new Map();
let activeRegions = Object.keys(REGION_COLORS);
let worldMapFeatures = null;

// === USE SHARED VIEW STATE MANAGER ===
const viewState = viewStateManager.getState();

// === D3 SELECTIONS ===
let mapWidth, mapHeight;
const svg = d3.select("#world-map");
const container = svg.append("g");
const mapGroup = container.append("g").attr("class", "map-group");
const bubblesGroup = container.append("g").attr("class", "bubbles-group");

let projection, path, zoom;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeMap() {
    const mapSection = document.querySelector('.map-section');
    mapWidth = mapSection.clientWidth;
    mapHeight = mapSection.clientHeight;

    svg.attr("width", mapWidth).attr("height", mapHeight);

    // Initialize rendering engine
    const result = renderingEngine.initialize(mapWidth, mapHeight);
    projection = result.projection;
    path = result.path;

    // Debounced zoom update
    const debouncedZoomUpdate = debounce(() => {
        if (viewState.mode === 'world') {
            updateGlobalBubbleSizes();
        } else if (viewState.mode === 'country') {
            updateEventBubbleSizes();
        }
    }, 50);

    zoom = d3.zoom()
        .scaleExtent([1, 500])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
            viewState.zoomScale = event.transform.k;
            debouncedZoomUpdate();
        });

    svg.call(zoom);

    // Setup UI controls
    createTimeSlider();
    setupModal();
    setupBackButton();
    setupCloseStatsButton();
    setupOceanClickToReset();
    setupPanelCollapse();
}

// Setup close button for stats panel
function setupCloseStatsButton() {
    const closeBtn = document.getElementById('close-stats');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            d3.select("#charts-panel").style("display", "none");
        });
    }
}

// Setup click on ocean/empty space to reset view
function setupOceanClickToReset() {
    svg.on("click", function (event) {
        if (event.target === this || event.target.classList.contains('sphere')) {
            if (viewState.mode === 'country' || viewState.mode === 'event') {
                returnToWorldView();
            }
        }
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    initializeMap();
    if (viewState.mode === 'world') {
        drawWorldMap();
        drawGlobalCountryBubbles();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        drawIndividualEventBubbles();
        updateAllCharts();
        updateLeftPanel();
    }
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
    try {
        const data = await d3.csv(CSV_FILE_PATH);

        // Use shared processRawData
        rawData = processRawData(data);

        // Initialize data filter manager
        dataFilterManager.initialize(rawData);

        // Use aggregationManager
        processedData = aggregationManager.aggregateByCountry(rawData, countryData);

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

        // Initialize Global View
        initializeGlobalView();

    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// ============================================================================
// GLOBAL VIEW INITIALIZATION
// ============================================================================

function initializeGlobalView() {
    viewState.mode = 'world';
    viewState.selectedCountryName = null;
    viewState.selectedCountryData = null;
    viewState.selectedEvent = null;

    // Draw world map
    drawWorldMap();

    // Draw country bubbles
    drawGlobalCountryBubbles();

    // Update left panel with global stats
    updateGlobalPanel();

    // Setup legend and filters
    createLegend();
    createViolenceTypeFilter();

    // Show top countries in right panel
    renderTopCountriesList();

    // Hide back button in world view
    d3.select("#reset-zoom").style("display", "none");
}

// ============================================================================
// MAP RENDERING
// ============================================================================

async function drawWorldMap() {
    await renderingEngine.drawWorldMap(mapGroup, handleCountryClick);
    worldMapFeatures = renderingEngine.getWorldMapFeatures();
}

// ============================================================================
// GLOBAL COUNTRY BUBBLES
// ============================================================================

function drawGlobalCountryBubbles() {
    bubblesGroup.selectAll(".conflict-bubble").interrupt();

    const currentYear = +document.getElementById('year-slider').value;

    const filterOptions = { year: currentYear, regions: activeRegions };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    const currentYearData = dataFilterManager.filter(filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    const filteredCountries = currentCountryData.filter(d =>
        activeRegions.includes(d.region) && d.coordinates
    );

    renderingEngine.drawConflictBubbles(
        bubblesGroup,
        filteredCountries,
        viewState.zoomScale,
        handleBubbleClick
    );
}

function updateGlobalBubbleSizes() {
    const currentYear = +document.getElementById('year-slider').value;

    const filterOptions = { year: currentYear, regions: activeRegions };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    const currentYearData = dataFilterManager.filter(filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    const filteredCountries = currentCountryData.filter(d =>
        activeRegions.includes(d.region) && d.coordinates
    );

    renderingEngine.updateBubbleSizes(bubblesGroup, filteredCountries, viewState.zoomScale);
}

// ============================================================================
// COUNTRY CLICK HANDLING
// ============================================================================

function handleBubbleClick(event, d) {
    event.stopPropagation();
    enterCountryView(d.name, d);
}

function handleCountryClick(event, d) {
    event.stopPropagation();
    const countryName = d.properties.name;

    const countryInfo = processedData.find(c => c.name === countryName);
    if (countryInfo) {
        enterCountryView(countryName, countryInfo);
    }
}

function enterCountryView(countryName, countryInfo) {
    viewState.mode = 'country';
    viewState.selectedCountryName = countryName;
    viewState.selectedCountryData = countryInfo;
    viewState.selectedEvent = null;

    // Clear existing bubbles
    bubblesGroup.selectAll(".conflict-bubble").remove();

    // Find country feature for zoom
    const countryFeature = renderingEngine.findCountryFeature(countryName);
    if (countryFeature) {
        zoomToCountry(countryFeature);
    }

    // Draw individual event bubbles and update panels
    setTimeout(() => {
        drawIndividualEventBubbles();
        updateCountryPanel();
        updateDashboardUI();
    }, 300);

    // Show back button and right panel
    d3.select("#reset-zoom").style("display", "block");
    d3.select("#charts-panel").style("display", "flex");
}

function zoomToCountry(countryFeature) {
    const bounds = path.bounds(countryFeature);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    const scale = Math.max(1, Math.min(50, 0.9 / Math.max(dx / mapWidth, dy / mapHeight)));
    const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// ============================================================================
// INDIVIDUAL EVENT BUBBLES (Country View)
// ============================================================================

function drawIndividualEventBubbles() {
    if (!viewState.selectedCountryData) return;

    const currentYear = +document.getElementById('year-slider').value;

    let events = viewState.selectedCountryData.eventsWithCoords?.filter(e => e.year <= currentYear) || [];

    if (viewState.selectedViolenceType) {
        events = events.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
    }

    // Filter by selected faction from Active Factions panel
    if (viewState.selectedFaction) {
        events = events.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(viewState.selectedFaction) || sideB.includes(viewState.selectedFaction);
        });
    }

    const maxCasualties = d3.max(events, d => d.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [3 / zoomFactor, 20 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    const eventBubbles = bubblesGroup.selectAll(".event-bubble")
        .data(events, (d, i) => `${d.country}-${d.year}-${i}`);

    eventBubbles.exit().remove();

    const enter = eventBubbles.enter()
        .append("circle")
        .attr("class", "event-bubble")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 0)
        .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
        .style("fill-opacity", 0.75)
        .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.15))")
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => renderingEngine.showEventTooltip(event, d))
        .on("mouseout", () => renderingEngine.hideEventTooltip())
        .on("click", (event, d) => {
            event.stopPropagation();
            selectEvent(d);
        });

    enter.transition()
        .duration(500)
        .attr("r", d => radiusScale(d.best));

    eventBubbles
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => radiusScale(d.best))
        .classed("selected-event", d => viewState.selectedEvent && d === viewState.selectedEvent)
        .classed("unselected-event", d => viewState.selectedEvent && d !== viewState.selectedEvent);
}

function updateEventBubbleSizes() {
    if (!viewState.selectedCountryData) return;

    const currentYear = +document.getElementById('year-slider').value;
    let events = viewState.selectedCountryData.eventsWithCoords?.filter(e => e.year <= currentYear) || [];

    if (viewState.selectedViolenceType) {
        events = events.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
    }

    const maxCasualties = d3.max(events, d => d.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [3 / zoomFactor, 20 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".event-bubble")
        .transition()
        .duration(100)
        .attr("r", d => radiusScale(d.best));
}

function selectEvent(event) {
    if (viewState.selectedEvent === event) return;

    viewState.selectedEvent = event;
    viewState.mode = 'event';

    requestAnimationFrame(() => {
        bubblesGroup.selectAll(".event-bubble")
            .classed("selected-event", d => d === event)
            .classed("unselected-event", d => d !== event);
    });

    requestAnimationFrame(() => {
        renderEventDetailsView(event);
    });
}

// ============================================================================
// NAVIGATION
// ============================================================================

function navigateBack() {
    if (viewState.mode === 'event') {
        viewState.selectedEvent = null;
        viewState.mode = 'country';

        bubblesGroup.selectAll(".event-bubble")
            .classed("selected-event", false)
            .classed("unselected-event", false);

        updateDashboardUI();
        updateCountryPanel();
        return true;
    }

    if (viewState.mode === 'country') {
        returnToWorldView();
        return true;
    }

    return false;
}

function returnToWorldView() {
    viewState.mode = 'world';
    viewState.selectedCountryName = null;
    viewState.selectedCountryData = null;
    viewState.selectedEvent = null;

    // Reset zoom
    svg.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);

    // Clear event bubbles
    bubblesGroup.selectAll(".event-bubble").remove();

    // Restore legend sections
    d3.select(".legend-section").style("display", "block");
    d3.select(".violence-filter-section").style("display", "block");

    // Clear country info panel
    d3.select("#country-info-panel").remove();

    // Restore stats container
    const leftPanel = d3.select("#left-panel");
    if (leftPanel.select(".stats-container").empty()) {
        const statsContainer = leftPanel.insert("div", ":first-child")
            .attr("class", "stats-container");
        statsContainer.append("h3").text("Overview Statistics");
        statsContainer.append("div").attr("class", "stat-item")
            .html('<span class="stat-label">Total Events:</span><span id="total-events" class="stat-value">...</span>');
        statsContainer.append("div").attr("class", "stat-item")
            .html('<span class="stat-label">Total Casualties:</span><span id="total-casualties" class="stat-value">...</span>');
    }

    // Redraw country bubbles
    setTimeout(() => {
        drawGlobalCountryBubbles();
        updateGlobalPanel();
        renderTopCountriesList();
    }, 300);

    d3.select("#reset-zoom").style("display", "none");
}

function setupBackButton() {
    d3.select("#reset-zoom").on("click", () => navigateBack());
}

// ============================================================================
// LEFT PANEL - GLOBAL STATS
// ============================================================================

function updateGlobalPanel() {
    const leftPanel = d3.select("#left-panel");

    // Keep legend sections visible
    d3.select(".legend-section").style("display", "block");
    d3.select(".violence-filter-section").style("display", "block");

    // Update overview stats
    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear, regions: activeRegions };

    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    const filteredData = dataFilterManager.filter(filterOptions);
    const totalEvents = filteredData.length;
    const totalCasualties = d3.sum(filteredData, d => d.best);

    d3.select("#total-events").text(d3.format(",d")(totalEvents));
    d3.select("#total-casualties").text(d3.format(",d")(totalCasualties));
}

function updateLeftPanel() {
    if (viewState.mode === 'world') {
        updateGlobalPanel();
    } else if (viewState.mode === 'country') {
        updateCountryPanel();
    }
}

// ============================================================================
// LEFT PANEL - COUNTRY DETAILS (Matching Graph View's updateFactionPanel)
// ============================================================================

function updateCountryPanel() {
    const leftPanel = d3.select("#left-panel");
    const countryName = viewState.selectedCountryName;
    const countryInfo = viewState.selectedCountryData;

    if (!countryInfo) return;

    // Clear existing content
    leftPanel.selectAll(".stats-container").remove();
    leftPanel.select("#country-info-panel").remove();

    // Hide legend sections during country view (like faction view)
    d3.select(".legend-section").style("display", "none");
    d3.select(".violence-filter-section").style("display", "none");

    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear };

    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    const events = dataFilterManager.getCountryEvents(countryName, filterOptions);
    const casualties = d3.sum(events, e => e.best);
    const region = countryInfo.region || "Unknown";

    // Get unique factions
    const factions = new Set();
    events.forEach(e => {
        if (e.side_a) factions.add(e.side_a);
        if (e.side_b) factions.add(e.side_b);
    });

    // Create country info panel (matching updateFactionPanel styling)
    const countryPanel = leftPanel.insert("div", ":first-child")
        .attr("id", "country-info-panel")
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
            <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${countryName}</div>
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
    regionStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Region");
    regionStat.append("div")
        .style("font-weight", "600")
        .style("color", REGION_COLORS[region] || "#64748b")
        .text(region);

    // Events stat
    const eventsStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    eventsStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Events");
    eventsStat.append("div")
        .style("font-weight", "700")
        .style("color", "#3b82f6")
        .text(d3.format(",d")(events.length));

    // Casualties stat
    const casualtiesStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    casualtiesStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Casualties");
    casualtiesStat.append("div")
        .style("font-weight", "700")
        .style("color", "#ef4444")
        .text(d3.format(",d")(casualties));

    // Factions stat
    const factionsStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    factionsStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Factions");
    factionsStat.append("div")
        .style("font-weight", "700")
        .style("color", "#8b5cf6")
        .text(factions.size);

    // Activity Period
    if (events.length > 0) {
        const years = events.map(e => e.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const periodStat = statsGrid.append("div")
            .style("background", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "6px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)")
            .style("grid-column", "1 / -1");

        periodStat.append("div")
            .style("font-size", "0.75rem")
            .style("color", "#94a3b8")
            .style("margin-bottom", "0.25rem")
            .text("Activity Period");

        periodStat.append("div")
            .style("font-weight", "600")
            .style("color", "#64748b")
            .text(`${minYear} - ${maxYear} (${maxYear - minYear + 1} years)`);
    }

    // Activity by Year Heatmap (using shared function with months on Y-axis)
    if (events.length > 0) {
        renderActivityHeatmap(countryPanel, events, "Activity by Year");
    }

    // Violence Type Distribution (Click to Filter)
    if (events.length > 0) {
        const violenceTypes = d3.rollup(
            events,
            v => ({ count: v.length, casualties: d3.sum(v, e => e.best) }),
            d => d.type_of_violence_name
        );

        countryPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Violence Type Distribution (Click to Filter)");

        const violenceContainer = countryPanel.append("div")
            .attr("id", "violence-type-filter-container")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem");

        const sortedTypes = Array.from(violenceTypes.entries())
            .sort((a, b) => b[1].casualties - a[1].casualties);

        const maxCasualties = d3.max(sortedTypes, d => d[1].casualties);

        sortedTypes.forEach(([type, data]) => {
            const percentage = (data.casualties / maxCasualties) * 100;
            const isSelected = viewState.selectedViolenceType === type;

            const typeRow = violenceContainer.append("div")
                .attr("class", "violence-type-row")
                .attr("data-type", type)
                .style("margin-bottom", "0.5rem")
                .style("padding", "0.5rem")
                .style("border-radius", "4px")
                .style("cursor", "pointer")
                .style("background", isSelected ? "#dbeafe" : "transparent")
                .style("border-left", isSelected ? `3px solid ${TYPE_COLORS[type] || '#64748b'}` : "3px solid transparent")
                .style("transition", "all 0.2s ease")
                .on("mouseenter", function () {
                    if (!isSelected) d3.select(this).style("background", "#f1f5f9");
                })
                .on("mouseleave", function () {
                    if (!isSelected) d3.select(this).style("background", "transparent");
                })
                .on("click", function () {
                    // Toggle filter
                    if (viewState.selectedViolenceType === type) {
                        viewState.selectedViolenceType = null;
                    } else {
                        viewState.selectedViolenceType = type;
                    }
                    // Update visual selection
                    violenceContainer.selectAll(".violence-type-row")
                        .style("background", function () {
                            const itemType = d3.select(this).attr("data-type");
                            return viewState.selectedViolenceType === itemType ? "#dbeafe" : "transparent";
                        })
                        .style("border-left", function () {
                            const itemType = d3.select(this).attr("data-type");
                            const picked = viewState.selectedViolenceType === itemType;
                            return picked ? `3px solid ${TYPE_COLORS[itemType] || '#64748b'}` : "3px solid transparent";
                        });
                    // Refresh map bubbles and charts
                    drawIndividualEventBubbles();
                    updateDashboardUI();
                });

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
    }
}

// ============================================================================
// RIGHT PANEL - CHARTS (Using ChartRenderer)
// ============================================================================

function updateAllCharts() {
    if (viewState.mode === 'world') {
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        updateDashboardUI();
    } else if (viewState.mode === 'event') {
        renderEventDetailsView(viewState.selectedEvent);
    }
}

function getFilteredData() {
    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear };

    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    if (viewState.mode === 'country' && viewState.selectedCountryName) {
        return dataFilterManager.getCountryEvents(viewState.selectedCountryName, filterOptions);
    }

    filterOptions.regions = activeRegions;
    return dataFilterManager.filter(filterOptions);
}

function updateDashboardUI() {
    if (typeof ChartRenderer === 'undefined' || typeof dataManager === 'undefined') {
        console.warn('ChartRenderer or dataManager not loaded');
        return;
    }

    let filteredEvents = getFilteredData();
    const countryName = viewState.selectedCountryName || 'Country';
    const region = viewState.selectedCountryData?.region || '';

    // Apply faction filter if selected
    if (viewState.selectedFaction && filteredEvents) {
        filteredEvents = filteredEvents.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(viewState.selectedFaction) || sideB.includes(viewState.selectedFaction);
        });
    }

    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");

    // Update header (show faction filter if active)
    const headerTitle = viewState.selectedFaction
        ? `${countryName} - ${viewState.selectedFaction.length > 20 ? viewState.selectedFaction.substring(0, 17) + '...' : viewState.selectedFaction}`
        : `${countryName} Statistics`;
    d3.select("#charts-title").text(headerTitle);
    d3.select("#charts-subtitle").text(viewState.selectedFaction ? "Filtered by Faction" : region);

    // Show/hide appropriate containers
    chartsPanel.selectAll(".chart-container").style("display", "block");
    d3.select("#top-countries-list").style("display", "none");
    d3.select("#event-text-details").style("display", "none");

    if (!filteredEvents || filteredEvents.length === 0) {
        d3.select("#chart-timeline").selectAll("*").remove();
        d3.select("#faction-connected-chart").html('<p style="color: #94a3b8; text-align: center;">No data available</p>');
        d3.select("#chart-top-events").html('<p style="color: #94a3b8; text-align: center;">No events available</p>');
        return;
    }

    const chartData = dataManager.aggregateDataForCharts(filteredEvents);

    // Chart 1: Timeline
    ChartRenderer.drawTimelineChart(chartData.byYear, '#chart-timeline');

    // Chart 2: Active Factions horizontal bar chart (Click to Filter)
    renderActiveFactionsChart(filteredEvents);

    // Chart 3: Top Events
    ChartRenderer.renderTopEventsList(chartData.topEvents, '#chart-top-events', {
        onEventClick: (event) => selectEvent(event)
    });
}

// ============================================================================
// ACTIVE FACTIONS HORIZONTAL BAR CHART (Matching Graph View)
// ============================================================================

function renderActiveFactionsChart(events) {
    const container = d3.select("#faction-connected-chart");
    container.html("");

    if (!events || events.length === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No factions data");
        return;
    }

    // Aggregate CONFLICTS (event count) by faction
    const factionConflicts = {};
    events.forEach(event => {
        const sideA = event.side_a || '';
        const sideB = event.side_b || '';

        if (sideA) {
            if (!factionConflicts[sideA]) {
                factionConflicts[sideA] = { conflicts: 0, casualties: 0 };
            }
            factionConflicts[sideA].conflicts++;
            factionConflicts[sideA].casualties += event.deaths_a || 0;
        }

        if (sideB) {
            if (!factionConflicts[sideB]) {
                factionConflicts[sideB] = { conflicts: 0, casualties: 0 };
            }
            factionConflicts[sideB].conflicts++;
            factionConflicts[sideB].casualties += event.deaths_b || 0;
        }
    });

    // Convert to array and sort by CONFLICTS (not casualties)
    const topFactions = Object.entries(factionConflicts)
        .map(([name, data]) => ({
            name,
            conflicts: data.conflicts,
            casualties: data.casualties
        }))
        .sort((a, b) => b.conflicts - a.conflicts)
        .slice(0, 8);

    if (topFactions.length === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No factions data");
        return;
    }

    const maxConflicts = d3.max(topFactions, d => d.conflicts) || 1;

    // Render horizontal bars
    topFactions.forEach((faction, index) => {
        const percentage = (faction.conflicts / maxConflicts) * 100;
        const isSelected = viewState.selectedFaction === faction.name;

        // Get color based on index
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
        const color = colors[index % colors.length];

        const row = container.append("div")
            .attr("class", "active-faction-item")
            .attr("data-faction", faction.name)
            .style("margin-bottom", "0.5rem")
            .style("padding", "0.5rem")
            .style("border-radius", "6px")
            .style("cursor", "pointer")
            .style("background", isSelected ? "#dbeafe" : "transparent")
            .style("border-left", isSelected ? `3px solid ${color}` : "3px solid transparent")
            .style("transition", "all 0.2s ease")
            .on("mouseenter", function () {
                if (!isSelected) d3.select(this).style("background", "#f1f5f9");
            })
            .on("mouseleave", function () {
                if (!isSelected) d3.select(this).style("background", "transparent");
            })
            .on("click", () => {
                // Toggle filter
                if (viewState.selectedFaction === faction.name) {
                    viewState.selectedFaction = null;
                } else {
                    viewState.selectedFaction = faction.name;
                }
                // Update visual selection
                container.selectAll(".active-faction-item")
                    .style("background", function () {
                        const itemFaction = d3.select(this).attr("data-faction");
                        return viewState.selectedFaction === itemFaction ? "#dbeafe" : "transparent";
                    })
                    .style("border-left", function () {
                        const itemFaction = d3.select(this).attr("data-faction");
                        const idx = topFactions.findIndex(f => f.name === itemFaction);
                        const c = colors[idx % colors.length];
                        return viewState.selectedFaction === itemFaction ? `3px solid ${c}` : "3px solid transparent";
                    });
                // Update map bubbles
                drawIndividualEventBubbles();
                // Update top events list
                updateDashboardUI();
            });

        // Faction name and CONFLICT COUNT
        row.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.25rem")
            .style("font-size", "0.75rem")
            .html(`
                <span style="color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%;" title="${faction.name}">
                    ${faction.name.length > 25 ? faction.name.substring(0, 22) + '...' : faction.name}
                </span>
                <span style="color: ${color}; font-weight: 600;">${d3.format(",d")(faction.conflicts)} conflicts</span>
            `);

        // Horizontal bar
        row.append("div")
            .style("height", "8px")
            .style("background", "#e2e8f0")
            .style("border-radius", "4px")
            .style("overflow", "hidden")
            .append("div")
            .style("width", `${percentage}%`)
            .style("height", "100%")
            .style("background", `linear-gradient(90deg, ${color} 0%, ${d3.color(color).brighter(0.3)} 100%)`)
            .style("border-radius", "4px")
            .style("transition", "width 0.3s ease");
    });
}

// ============================================================================
// TOP COUNTRIES LIST
// ============================================================================

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
        // Hide sort controls in country/region view
        if (!sortControls.empty()) {
            sortControls.style("display", "none");
        }
    } else {
        // Show sort controls in world view
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
                        // Update button styles
                        sortControls.selectAll(".sort-btn")
                            .style("background", function () {
                                return this.getAttribute("data-mode") === countrySortMode ? "#2563eb" : "#334155";
                            });
                        // Re-render with new sort
                        renderTopCountriesList();
                    });
            });
        } else {
            // Show and update style for existing controls
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
        // average casualties per conflict
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
                enterCountryView(country.name, country);
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
// EVENT DETAILS VIEW
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
            ` : `
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
                <strong>Location:</strong> ${event.country}, ${event.region}
            </div>
            `}
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
                <div style="height: 100%; background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); width: ${(event.deaths_civilians / event.best * 100)}%;" title="Civilians: ${d3.format(",d")(event.deaths_civilians)} (${d3.format(".1%")(event.deaths_civilians / event.best)})">
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
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #dc2626;">
                    <span style="font-size: 0.8rem; color: #475569;">Civilians</span>
                    <span style="font-weight: 600; color: #dc2626;">${d3.format(",d")(event.deaths_civilians)}</span>
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
        
        <!-- Factions Involved -->
        <div style="padding: 1rem; background: white; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.05);">
            <h4 style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem;">
                Factions Involved
            </h4>
            ${event.side_a ? `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(239, 68, 68, 0.05); border-radius: 4px; margin-bottom: 0.5rem;">
                <span style="font-size: 0.8rem; color: #475569; font-weight: 500;">${event.side_a}</span>
                <span style="font-size: 0.75rem; color: #ef4444;">Side A</span>
            </div>
            ` : ''}
            ${event.side_b ? `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 4px;">
                <span style="font-size: 0.8rem; color: #475569; font-weight: 500;">${event.side_b}</span>
                <span style="font-size: 0.75rem; color: #3b82f6;">Side B</span>
            </div>
            ` : ''}
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
// TIME SLIDER
// ============================================================================

function createTimeSlider() {
    const slider = document.getElementById('year-slider');
    if (!slider) return;

    slider.addEventListener('input', function () {
        const year = +this.value;
        document.getElementById('year-current').textContent = year;
        updateMapForYear();
    });

    // Play button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        let playing = false;
        let interval;

        playBtn.addEventListener('click', function () {
            if (playing) {
                clearInterval(interval);
                this.textContent = '▶ Play';
                playing = false;
            } else {
                this.textContent = '⏸ Pause';
                playing = true;

                interval = setInterval(() => {
                    const currentVal = +slider.value;
                    const maxVal = +slider.max;

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
    if (viewState.mode === 'world') {
        drawGlobalCountryBubbles();
        updateGlobalPanel();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        drawIndividualEventBubbles();
        updateCountryPanel();
        updateDashboardUI();
    }
}

// ============================================================================
// LEGEND & FILTERS
// ============================================================================

function createLegend() {
    const legendContainer = d3.select("#legend");
    legendContainer.selectAll("*").remove();

    Object.entries(REGION_COLORS).forEach(([region, color]) => {
        const item = legendContainer.append("div")
            .attr("class", "legend-item active")
            .attr("data-region", region)
            .on("click", function () {
                toggleRegionFilter(region, this);
            });

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("span").text(region);
    });
}

function toggleRegionFilter(region, element) {
    const idx = activeRegions.indexOf(region);

    if (idx >= 0) {
        activeRegions.splice(idx, 1);
        d3.select(element).classed("active", false);
    } else {
        activeRegions.push(region);
        d3.select(element).classed("active", true);
    }

    // Refresh view
    if (viewState.mode === 'world') {
        drawGlobalCountryBubbles();
        updateGlobalPanel();
        renderTopCountriesList();
    }
}

function createViolenceTypeFilter() {
    const container = d3.select("#violence-type-filter");
    container.selectAll("*").remove();

    // All types option
    const allItem = container.append("div")
        .attr("class", "legend-item active")
        .on("click", function () {
            viewState.selectedViolenceType = null;
            container.selectAll(".legend-item").classed("selected", false);
            d3.select(this).classed("selected", true);
            applyFilters();
        });

    allItem.append("div")
        .attr("class", "legend-color")
        .style("background-color", "#64748b");

    allItem.append("span").text("All Types");

    // Individual types
    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const item = container.append("div")
            .attr("class", "legend-item active")
            .on("click", function () {
                viewState.selectedViolenceType = type;
                container.selectAll(".legend-item").classed("selected", false);
                d3.select(this).classed("selected", true);
                applyFilters();
            });

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("span").text(type);
    });
}

function applyFilters() {
    if (viewState.mode === 'world') {
        drawGlobalCountryBubbles();
        updateGlobalPanel();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        drawIndividualEventBubbles();
        updateCountryPanel();
        updateDashboardUI();
    }
}

// ============================================================================
// MODAL
// ============================================================================

function setupModal() {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ============================================================================
// PANEL COLLAPSE FUNCTIONALITY
// ============================================================================

function setupPanelCollapse() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('charts-panel');
    const leftToggleBtn = document.getElementById('left-panel-toggle');
    const rightToggleBtn = document.getElementById('right-panel-toggle');
    const contentWrapper = document.querySelector('.content-wrapper');
    const timeSlider = document.querySelector('.time-slider-container');

    let hideButtonTimeout = null;
    const EDGE_DISTANCE = 80;
    const HIDE_DELAY = 1500;

    // Toggle functions - panels toggle on/off when buttons are clicked
    if (leftToggleBtn) {
        leftToggleBtn.addEventListener('click', () => {
            const isCollapsed = leftPanel.classList.toggle('collapsed');
            leftToggleBtn.classList.toggle('collapsed', isCollapsed);
            updateLayoutAndCenter();
            leftToggleBtn.innerHTML = isCollapsed ? '▶' : '◀';
        });
    }

    if (rightToggleBtn) {
        rightToggleBtn.addEventListener('click', () => {
            const isCollapsed = rightPanel.classList.toggle('collapsed');
            rightToggleBtn.classList.toggle('collapsed', isCollapsed);
            updateLayoutAndCenter();
            rightToggleBtn.innerHTML = isCollapsed ? '◀' : '▶';
        });
    }

    // Mouse proximity detection for auto-show/hide
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const windowWidth = window.innerWidth;

        clearTimeout(hideButtonTimeout);

        const isNearLeftEdge = mouseX < EDGE_DISTANCE;
        const isNearRightEdge = mouseX > windowWidth - EDGE_DISTANCE;

        if (isNearLeftEdge && leftToggleBtn) {
            leftToggleBtn.style.opacity = '1';
            leftToggleBtn.style.pointerEvents = 'auto';
        }

        if (isNearRightEdge && rightToggleBtn) {
            rightToggleBtn.style.opacity = '1';
            rightToggleBtn.style.pointerEvents = 'auto';
        }

        hideButtonTimeout = setTimeout(() => {
            if (leftToggleBtn && mouseX >= EDGE_DISTANCE) {
                leftToggleBtn.style.opacity = '0';
                leftToggleBtn.style.pointerEvents = 'none';
            }
            if (rightToggleBtn && mouseX <= windowWidth - EDGE_DISTANCE) {
                rightToggleBtn.style.opacity = '0';
                rightToggleBtn.style.pointerEvents = 'none';
            }
        }, HIDE_DELAY);
    });

    // Keep buttons visible when hovering over them
    [leftToggleBtn, rightToggleBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('mouseenter', () => {
                clearTimeout(hideButtonTimeout);
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
        }
    });

    // Update grid layout, center content, and adjust time slider
    function updateLayoutAndCenter() {
        const leftCollapsed = leftPanel.classList.contains('collapsed');
        const rightCollapsed = rightPanel.classList.contains('collapsed');

        contentWrapper.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');

        if (leftCollapsed && rightCollapsed) {
            contentWrapper.classList.add('both-collapsed');
        } else if (leftCollapsed) {
            contentWrapper.classList.add('left-collapsed');
        } else if (rightCollapsed) {
            contentWrapper.classList.add('right-collapsed');
        }

        if (timeSlider) {
            if (leftCollapsed && rightCollapsed) {
                timeSlider.style.width = '80%';
            } else if (leftCollapsed || rightCollapsed) {
                timeSlider.style.width = '70%';
            } else {
                timeSlider.style.width = '60%';
            }
        }

        // Wait for CSS transition, then recalculate map dimensions
        setTimeout(() => {
            const mapSection = document.querySelector('.map-section');
            if (mapSection) {
                mapWidth = mapSection.clientWidth;
                mapHeight = mapSection.clientHeight;
                svg.attr("width", mapWidth).attr("height", mapHeight);
            }
        }, 450);
    }
}

// ============================================================================
// STARTUP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    loadData();
});
