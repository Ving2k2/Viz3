// ============================================================================
// GLOBAL CONFLICT MAP VISUALIZATION - ENHANCED
// Full-width map with proper zoom, individual events, and country information
// ============================================================================

// Note: CSV_FILE_PATH, REGION_COLORS, TYPE_MAP, TYPE_COLORS are defined in shared.js


// === GLOBAL STATE ===
let rawData = [];
let processedData = [];
let countryData = new Map();
let activeRegions = Object.keys(REGION_COLORS);
let worldMapFeatures = null; // Store world map features for neighbor detection
let provinceFeatures = null; // Store province/state features for borders
// === USE SHARED VIEW STATE MANAGER ===
const viewState = viewStateManager.getState();

// === D3 SELECTIONS ===
let mapWidth, mapHeight;
const svg = d3.select("#world-map");
const container = svg.append("g");
const mapGroup = container.append("g").attr("class", "map-group");
const bubblesGroup = container.append("g").attr("class", "bubbles-group");

let projection, path, zoom;

// === PERFORMANCE OPTIMIZATION ===
let lastEventSelectTime = 0;
let cachedVictimChartSVG = null;
let cachedVictimChartG = null;

// ============================================================================
// INITIALIZATION & RESPONSIVE
// ============================================================================

// Debounce utility function for performance optimization

function initializeMap() {
    const mapSection = document.querySelector('.map-section');
    mapWidth = mapSection.clientWidth;
    mapHeight = mapSection.clientHeight;

    svg.attr("width", mapWidth).attr("height", mapHeight);

    // Initialize rendering engine with projection
    const result = renderingEngine.initialize(mapWidth, mapHeight);
    projection = result.projection;
    path = result.path;

    // Debounced zoom update for better performance
    const debouncedZoomUpdate = debounce(() => {
        if (viewState.mode === 'region') {
            updateRegionBubbles();
        } else if (viewState.mode === 'world') {
            updateWorldBubbles();
        } else if (viewState.mode === 'country') {
            updateCapitalMarkerSize();
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

    // Initialize Time Slider logic
    createTimeSlider();
    setupModal();
    setupBackButton();
    setupViewToggle(); // Initialize view mode toggle buttons
}

window.addEventListener('resize', () => {
    initializeMap();
    if (viewState.mode === 'world') {
        drawWorldMap();
        drawConflictBubbles();
        renderTopCountriesList();
    } else if (viewState.mode === 'country') {
        drawIndividualEventBubbles();
        updateAllCharts();
        updateLeftPanel();
    } else if (viewState.mode === 'region') {
        toggleRegion(viewState.selectedRegion);
    } else if (viewState.mode === 'event') {
        renderEventDetailsView(viewState.selectedEvent);
    }
});

// ============================================================================
// DATA PROCESSING
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

        updateStats();
        createLegend();
        createViolenceTypeFilter();

        // Initialize slider range based on data
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

// Diagnostic function to verify all countries can be mapped
function verifyCountryMappings() {
    if (!worldMapFeatures || !processedData) {
        console.warn("⚠️ Cannot verify mappings - map or data not loaded yet");
        return;
    }

    const mapCountryNames = worldMapFeatures.map(f => f.properties.name);
    const unmappedCountries = [];
    const mappedCountries = [];



    processedData.forEach(countryData => {
        const countryName = countryData.name;

        // Check exact match
        if (mapCountryNames.includes(countryName)) {
            mappedCountries.push(countryName);
            return;
        }

        // Check normalized match
        const normalize = (str) => str.toLowerCase()
            .replace(/\bthe\b/g, '')
            .replace(/\brepublic of\b/g, '')
            .replace(/\bdemocratic republic of\b/g, '')
            .replace(/\bkingdom of\b/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const normalizedTarget = normalize(countryName);
        const normalizedMatch = mapCountryNames.find(name => normalize(name) === normalizedTarget);

        if (normalizedMatch) {
            mappedCountries.push(countryName);
            return;
        }

        // Check manual mapping (from handleBubbleClick function)
        const manualMapping = {
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

            // === FIX FOR 6 UNMAPPED COUNTRIES ===
            "Bahrain": "Bahrain",
            "Comoros": "Comoros",
            "Kingdom of eSwatini (Swaziland)": "eSwatini",
            "Madagascar (Malagasy)": "Madagascar",
            "Malagasy": "Madagascar",
            "North Macedonia": "North Macedonia",
            "Solomon Islands": "Solomon Is."
        };

        if (manualMapping[countryName] && mapCountryNames.includes(manualMapping[countryName])) {
            mappedCountries.push(countryName);
            return;
        }

        // If we got here, country is unmapped
        unmappedCountries.push(countryName);
    });



    if (unmappedCountries.length > 0) {
        console.warn(`⚠️ UNMAPPED COUNTRIES (${unmappedCountries.length}):`, unmappedCountries.sort());


        // Automatically search for possible matches
        findMapNamesForUnmapped(unmappedCountries);
    } else {

    }

    return {
        total: processedData.length,
        mapped: mappedCountries.length,
        unmapped: unmappedCountries
    };
}

// Helper function to find exact map names for unmapped countries
function findMapNamesForUnmapped(unmappedCountries) {
    if (!worldMapFeatures) {
        console.warn("⚠️ Map not loaded yet");
        return;
    }

    const mapCountryNames = worldMapFeatures.map(f => f.properties.name);



    unmappedCountries.forEach(countryName => {


        // Find similar names
        const similar = mapCountryNames.filter(mapName => {
            const lowerCountry = countryName.toLowerCase();
            const lowerMap = mapName.toLowerCase();

            // Check if either contains the other, or if they share significant words
            const words = lowerCountry.split(/\s+/);
            const mapWords = lowerMap.split(/\s+/);

            return words.some(word => word.length > 3 && lowerMap.includes(word)) ||
                mapWords.some(word => word.length > 3 && lowerCountry.includes(word));
        });

        if (similar.length > 0) {

        } else {

        }
    });


}


function updateStats() {
    const currentYear = +document.getElementById('year-slider').value;

    // Use dataFilterManager for optimized filtering with caching
    let filterOptions = { year: currentYear };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    let filteredData;

    // Filter by region if selected
    if (viewState.selectedRegion) {
        filteredData = dataFilterManager.getRegionEvents(viewState.selectedRegion, filterOptions);
    } else {
        filterOptions.regions = activeRegions;
        filteredData = dataFilterManager.filter(filterOptions);
    }

    const totalEvents = filteredData.length;
    const totalCasualties = d3.sum(filteredData, d => d.best);

    d3.select("#total-events").text(d3.format(",d")(totalEvents));
    d3.select("#total-casualties").text(d3.format(",d")(totalCasualties));

    // Draw regional stacked bars (only in world view AND when no specific region is selected)
    if (viewState.mode === 'world' && !viewState.selectedRegion) {
        drawRegionalStackedBars(filteredData);
    } else if (viewState.mode === 'region' && viewState.selectedRegion) {
        // In regional view, show violence type stacked chart
        drawViolenceTypeStackedChart(filteredData);
    } else {
        d3.select("#regional-bars").remove();
    }
}

// ============================================================================
// MAP RENDERING
// ============================================================================

async function drawWorldMap() {
    try {
        const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        const countries = topojson.feature(world, world.objects.countries);
        worldMapFeatures = countries.features; // Store for neighbor detection

        mapGroup.selectAll("*").remove();

        mapGroup.append("path")
            .datum({ type: "Sphere" })
            .attr("class", "sphere")
            .attr("d", path);

        const graticule = d3.geoGraticule();
        mapGroup.append("path")
            .datum(graticule)
            .attr("class", "graticule")
            .attr("d", path);

        mapGroup.selectAll(".country")
            .data(countries.features)
            .join("path")
            .attr("class", "country")
            .attr("d", path)
            .style("cursor", "pointer")
            .on("click", handleCountryClick);


    } catch (error) {
        console.error("❌ Error loading world map:", error);
    }
}

function drawConflictBubbles() {
    const currentYear = +document.getElementById('year-slider').value;

    // Use dataFilterManager for optimized filtering with caching
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

    const bubbles = bubblesGroup.selectAll(".conflict-bubble")
        .data(filteredCountries, d => d.name);

    bubbles.exit()
        .transition()
        .duration(300)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    const enter = bubbles.enter()
        .append("circle")
        .attr("class", "conflict-bubble")
        .attr("cx", d => projection(d.coordinates)[0])
        .attr("cy", d => projection(d.coordinates)[1])
        .attr("r", 0)
        .style("fill", d => REGION_COLORS[d.region])
        .style("cursor", "pointer")
        .style("opacity", 0)
        .on("click", handleBubbleClick);

    enter.transition()
        .duration(500)
        .attr("r", d => radiusScale(d.totalCasualties))
        .style("opacity", 0.8);

    bubbles
        .transition()
        .duration(200)
        .attr("r", d => radiusScale(d.totalCasualties))
        .style("opacity", 0.8);
}

// Helper functions to update bubble sizes on zoom
function updateWorldBubbles() {
    const currentYear = +document.getElementById('year-slider').value;

    // Use dataFilterManager for optimized filtering
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

    // Use dataFilterManager for optimized region filtering
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
// NEIGHBOR DETECTION
// ============================================================================

function getNeighboringCountries(countryName) {
    if (!worldMapFeatures) return [];

    const targetCountry = worldMapFeatures.find(f => f.properties.name === countryName);
    if (!targetCountry) return [];

    const neighbors = [];
    const targetBounds = path.bounds(targetCountry);

    // Simple proximity-based neighbor detection
    worldMapFeatures.forEach(feature => {
        if (feature.properties.name === countryName) return;

        const featureBounds = path.bounds(feature);

        // Check if bounding boxes overlap or are very close
        const xOverlap = !(featureBounds[1][0] < targetBounds[0][0] - 50 || featureBounds[0][0] > targetBounds[1][0] + 50);
        const yOverlap = !(featureBounds[1][1] < targetBounds[0][1] - 50 || featureBounds[0][1] > targetBounds[1][1] + 50);

        if (xOverlap && yOverlap) {
            neighbors.push(feature.properties.name);
        }
    });

    return neighbors;
}


// ============================================================================
// INDIVIDUAL EVENT BUBBLES (Country View)
// ============================================================================

function drawIndividualEventBubbles() {
    if (!viewState.selectedCountryData) return;

    const currentYear = +document.getElementById('year-slider').value;

    // Filter events by year
    let events = viewState.selectedCountryData.eventsWithCoords.filter(e => e.year <= currentYear);

    if (viewState.selectedConflictType) {
        events = events.filter(e => e.type_of_violence_name === viewState.selectedConflictType);
    }

    // Apply faction filter if active
    if (viewState.selectedFaction) {
        events = events.filter(e => {
            const factionName = viewState.selectedFaction;
            const side_a = e.side_a || '';
            const side_b = e.side_b || '';
            // Check if faction appears in either side_a or side_b
            return side_a.includes(factionName) || side_b.includes(factionName);
        });
    }

    const maxCasualties = d3.max(events, d => d.best);
    const zoomFactor = viewState.zoomScale;

    // Scale bubbles inversely with zoom - smaller when zoomed in
    const baseRange = [3 / zoomFactor, 20 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    const eventBubbles = bubblesGroup.selectAll(".event-bubble")
        .data(events, (d, i) => `${d.country}-${d.year}-${i}`);

    eventBubbles.exit().remove(); // Remove immediately for performance

    const enter = eventBubbles.enter()
        .append("circle")
        .attr("class", "event-bubble")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => radiusScale(d.best))
        .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
        .style("cursor", "pointer")
        .classed("selected-event", d => viewState.selectedEvent && d === viewState.selectedEvent)
        .classed("unselected-event", d => viewState.selectedEvent && d !== viewState.selectedEvent)
        .on("mouseover", showEventTooltip)
        .on("mouseout", hideEventTooltip)
        .on("click", (event, d) => {
            event.stopPropagation();
            selectEvent(d);
        });

    if (events.length < 500) {
        enter.attr("r", 0)
            .transition()
            .duration(800)
            .attr("r", d => radiusScale(d.best));
    }

    // Update existing bubbles - use classes for selection state
    eventBubbles
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => radiusScale(d.best))
        .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
        .classed("selected-event", d => viewState.selectedEvent && d === viewState.selectedEvent)
        .classed("unselected-event", d => viewState.selectedEvent && d !== viewState.selectedEvent);
}

function selectEvent(event) {
    // Debounce: Ignore rapid clicks (within 50ms)
    const now = performance.now();
    if (now - lastEventSelectTime < 50) {
        return;
    }
    lastEventSelectTime = now;

    // Early exit if same event is already selected
    if (viewState.selectedEvent === event) {
        return;
    }

    viewState.selectedEvent = event;

    // OPTIMIZED: Use requestAnimationFrame and minimize DOM manipulation
    requestAnimationFrame(() => {
        // Fast path: Use class-based styling instead of individual style updates
        const bubbles = bubblesGroup.selectAll(".event-bubble");

        // Remove all previous selection classes
        bubbles.classed("selected-event", false)
            .classed("unselected-event", false);

        // Add selection class only to selected bubble
        bubbles.filter(d => d === event)
            .classed("selected-event", true);

        // Batch update non-selected bubbles - make them gray
        bubbles.filter(d => d !== event)
            .classed("unselected-event", true);
    });

    // OPTIMIZED: Defer heavy chart rendering to next frame
    requestAnimationFrame(() => {
        renderEventDetailsView(event);
    });
}

function showEventTooltip(event, d) {
    const tooltip = d3.select("body").append("div")
        .attr("class", "event-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(15, 23, 42, 0.95)")
        .style("color", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "8px")
        .style("font-size", "0.875rem")
        .style("pointer-events", "none")
        .style("z-index", "10000")
        .html(`
            <strong>${d.dyad_name || 'Unknown Event'}</strong><br>
            <span style="color: #94a3b8;">${d.date_start || d.year}</span><br>
            <span style="color: ${TYPE_COLORS[d.type_of_violence_name]};">${d.type_of_violence_name}</span><br>
            <strong style="color: #ef4444;">${d3.format(",d")(d.best)} casualties</strong><br>
            ${d.where_description ? `📍 ${d.where_description}` : ''}
        `);

    tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
}

function hideEventTooltip() {
    d3.selectAll(".event-tooltip").remove();
}

// OPTIMIZED: Render event details in right panel
function renderEventDetailsView(event) {
    if (!event) return;

    // Switch mode to event view
    viewState.mode = 'event';

    // Show right panel if hidden
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");

    // Update panel title
    d3.select("#charts-title").text("Event Details");
    d3.select("#charts-subtitle").text(event.dyad_name || "Conflict Event");

    // Hide standard chart containers
    chartsPanel.selectAll(".chart-container").style("display", "none");

    // Clear or create event details container
    let detailsContainer = chartsPanel.select("#event-text-details");
    if (detailsContainer.empty()) {
        detailsContainer = chartsPanel.append("div")
            .attr("id", "event-text-details")
            .attr("class", "chart-container")
            .style("display", "block");
    } else {
        detailsContainer.html('').style("display", "block");
    }

    // OPTIMIZED: Build HTML string once instead of multiple DOM operations
    const detailsHTML = `
        <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(0, 0, 0, 0.05);">
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                📅 ${event.date_start || event.year} • 🗺️ ${event.type_of_violence_name}
            </div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.3;">
                ${event.dyad_name || 'Unknown Conflict Event'}
            </div>
            ${event.where_description ? `
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
                📍 <strong>Location:</strong> ${event.where_description}
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
            <h4 style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center;">
                <span style="margin-right: 0.5rem;">📊</span> Casualties Breakdown by Group
            </h4>
            
            <!-- Visual Bar Chart -->
            <div id="casualties-bar-chart" style="margin-bottom: 1rem; height: 30px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex;">
                ${event.deaths_a > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); width: ${(event.deaths_a / event.best * 100)}%; position: relative;" title="Country Forces: ${d3.format(",d")(event.deaths_a)} (${d3.format(".1%")(event.deaths_a / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); width: ${(event.deaths_b / event.best * 100)}%; position: relative;" title="Opponent Forces: ${d3.format(",d")(event.deaths_b)} (${d3.format(".1%")(event.deaths_b / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_civilians > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); width: ${(event.deaths_civilians / event.best * 100)}%; position: relative;" title="Civilians: ${d3.format(",d")(event.deaths_civilians)} (${d3.format(".1%")(event.deaths_civilians / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_unknown > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #57534e 0%, #78716c 100%); width: ${(event.deaths_unknown / event.best * 100)}%; position: relative;" title="Unknown: ${d3.format(",d")(event.deaths_unknown)} (${d3.format(".1%")(event.deaths_unknown / event.best)})">
                </div>
                ` : ''}
            </div>
            
            <!-- Detailed Breakdown List -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${event.deaths_a > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #ef4444;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">🪖 Country Forces (Side A)</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_a)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_a / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">⚔️ Opponent Forces (Side B)</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_b)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_b / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_civilians > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #dc2626;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">👥 Civilian Casualties</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #dc2626; font-size: 0.9rem;">${d3.format(",d")(event.deaths_civilians)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_civilians / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_unknown > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #78716c;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #57534e 0%, #78716c 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">❓ Unknown Affiliation</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_unknown)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_unknown / event.best)}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${event.source_headline || event.source_article ? `
        <div style="padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.1);">
            <h4 style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; display: flex; align-items: center;">
                <span style="margin-right: 0.5rem;">📰</span> Source Information
            </h4>
            ${event.source_headline ? `<p style="font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem; font-style: italic; line-height: 1.5;">"${event.source_headline}"</p>` : ''}
            ${event.source_article ? `<p style="font-size: 0.75rem; color: #94a3b8; line-height: 1.4;">${event.source_article}</p>` : ''}
        </div>
        ` : ''}
    `;

    detailsContainer.html(detailsHTML);
}

// ============================================================================
// COUNTRY INTERACTIONS
// ============================================================================

// Helper function to find country feature using comprehensive matching
// Used by both bubble clicks and ranking list clicks
function findCountryFeature(countryName) {
    const allCountryFeatures = mapGroup.selectAll(".country").data();

    // Helper for normalization
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

    // 3. Check manual mapping FIRST (before fuzzy matching)
    const manualMapping = {
        // === HISTORICAL/POLITICAL NAME CHANGES ===
        "Cambodia (Kampuchea)": "Cambodia",
        "Kampuchea": "Cambodia",

        // Congo variations - MUST come before fuzzy matching
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

    if (manualMapping[countryName]) {
        countryFeature = allCountryFeatures.find(c => c.properties.name === manualMapping[countryName]);
        if (countryFeature) return countryFeature;
    }

    // 4. Last resort: fuzzy matching
    countryFeature = allCountryFeatures.find(c => {
        const mapName = c.properties.name;
        if (mapName.includes(countryName) || countryName.includes(mapName)) {
            if (Math.abs(mapName.length - countryName.length) > 10) return false;
            return true;
        }
        return false;
    });

    return countryFeature;
}

function handleCountryClick(event, d) {
    event.stopPropagation();

    // In faction view mode, handle differently - zoom to country and show faction events
    if (viewState.mode === 'faction' || viewState.selectedFactionName) {
        handleFactionCountryClick(event, d);
        return;
    }

    const mapCountryName = d.properties.name;

    // Reverse manual mapping: map feature name -> CSV country name
    const reverseMapping = {
        "Dem. Rep. Congo": "DR Congo (Zaire)",
        "Congo": "Congo",
        "S. Sudan": "South Sudan",
        "Central African Rep.": "Central African Republic",
        "Eq. Guinea": "Equatorial Guinea",
        "eSwatini": "Kingdom of eSwatini (Swaziland)",
        "Côte d'Ivoire": "Ivory Coast",
        "Lao PDR": "Laos",
        "Timor-Leste": "Timor-Leste (East Timor)",
        "Dem. Rep. Korea": "North Korea",
        "Korea": "South Korea",
        "Bosnia and Herz.": "Bosnia-Herzegovina",
        "North Macedonia": "Macedonia",
        "Czechia": "Czech Republic",
        "United States of America": "United States",
        "Dominican Rep.": "Dominican Republic",
        "Solomon Is.": "Solomon Islands",
        "Myanmar": "Myanmar (Burma)"
    };

    // Try to find the CSV name using reverse mapping
    const csvCountryName = reverseMapping[mapCountryName] || mapCountryName;

    // Try exact match with CSV name
    let countryConflictData = processedData.find(c => c.name === csvCountryName);

    // If no exact match, try fuzzy matching
    if (!countryConflictData) {
        // Trypartial matching
        countryConflictData = processedData.find(c =>
            c.name.includes(csvCountryName) || csvCountryName.includes(c.name)
        );

        // Try matching without common suffixes
        if (!countryConflictData) {
            const simplifiedMapName = csvCountryName
                .replace(/ \(.*\)/, '') // Remove parentheses
                .replace(/^The /, '') // Remove "The" prefix
                .replace(/ of America$/, ''); // Remove "of America" suffix

            countryConflictData = processedData.find(c => {
                const simplifiedDataName = c.name
                    .replace(/ \(.*\)/, '')
                    .replace(/^The /, '')
                    .replace(/ of America$/, '');
                return simplifiedDataName === simplifiedMapName;
            });
        }
    }

    if (!countryConflictData) {

        return;
    }

    enterCountryView(d, countryConflictData.name, countryConflictData);
}

function handleBubbleClick(event, d) {
    event.stopPropagation();

    const countryName = d.name;

    // 1. Try exact match first
    let countryFeature = mapGroup.selectAll(".country")
        .data()
        .find(c => c.properties.name === countryName);

    // 2. If no exact match, try normalized match
    if (!countryFeature) {
        const normalize = (str) => str.toLowerCase()
            .replace(/\bthe\b/g, '')
            .replace(/\brepublic of\b/g, '')
            .replace(/\bdemocratic republic of\b/g, '')
            .replace(/\bkingdom of\b/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const normalizedTarget = normalize(countryName);

        countryFeature = mapGroup.selectAll(".country")
            .data()
            .find(c => normalize(c.properties.name) === normalizedTarget);
    }

    // 3. Check manual mapping FIRST (before fuzzy matching)
    // This prevents "DR Congo (Zaire)" from matching "Congo" in fuzzy search
    if (!countryFeature) {
        const manualMapping = {
            // === HISTORICAL/POLITICAL NAME CHANGES ===

            // Cambodia
            "Cambodia (Kampuchea)": "Cambodia",
            "Kampuchea": "Cambodia",

            // Congo variations - MUST come before fuzzy matching
            "DR Congo (Zaire)": "Dem. Rep. Congo",
            "DR Congo": "Dem. Rep. Congo",
            "Democratic Republic of the Congo": "Dem. Rep. Congo",
            "Congo, DR": "Dem. Rep. Congo",
            "Zaire": "Dem. Rep. Congo",
            "Congo": "Congo",  // Republic of Congo
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

            // Serbia
            "Serbia (Yugoslavia)": "Serbia",
            "Yugoslavia": "Serbia",
            "Serbia and Montenegro": "Serbia",
            "Federal Republic of Yugoslavia": "Serbia",

            // Bosnia
            "Bosnia-Herzegovina": "Bosnia and Herz.",
            "Bosnia and Herzegovina": "Bosnia and Herz.",
            "Bosnia": "Bosnia and Herz.",

            // Montenegro
            "Montenegro": "Montenegro",

            // Macedonia
            "Macedonia": "North Macedonia",
            "FYROM": "North Macedonia",
            "Former Yugoslav Republic of Macedonia": "North Macedonia",

            // Croatia
            "Croatia": "Croatia",

            // Slovenia
            "Slovenia": "Slovenia",

            // === ASIAN COUNTRIES ===

            // Laos
            "Laos": "Lao PDR",

            // Vietnam
            "Vietnam": "Vietnam",
            "Viet Nam": "Vietnam",

            // Timor
            "Timor-Leste (East Timor)": "Timor-Leste",
            "East Timor": "Timor-Leste",

            // Korea
            "North Korea": "Dem. Rep. Korea",
            "South Korea": "Korea",
            "Republic of Korea": "Korea",

            // === AFRICAN COUNTRIES ===

            // North Africa
            "Libya": "Libya",
            "Egypt": "Egypt",
            "Tunisia": "Tunisia",
            "Algeria": "Algeria",
            "Morocco": "Morocco",

            // West Africa
            "Mauritania": "Mauritania",
            "Senegal": "Senegal",
            "Gambia": "Gambia",
            "Guinea-Bissau": "Guinea-Bissau",
            "Guinea": "Guinea",
            "Sierra Leone": "Sierra Leone",
            "Liberia": "Liberia",
            "Ivory Coast": "Côte d'Ivoire",
            "Mali": "Mali",
            "Burkina Faso": "Burkina Faso",
            "Ghana": "Ghana",
            "Togo": "Togo",
            "Benin": "Benin",
            "Niger": "Niger",
            "Nigeria": "Nigeria",

            // Central Africa
            "Chad": "Chad",
            "Cameroon": "Cameroon",
            "Central African Republic": "Central African Rep.",
            "Equatorial Guinea": "Eq. Guinea",
            "Gabon": "Gabon",
            "Congo": "Congo",
            "Republic of the Congo": "Congo",
            "DR Congo (Zaire)": "Dem. Rep. Congo",
            "DR Congo": "Dem. Rep. Congo",
            "Democratic Republic of the Congo": "Dem. Rep. Congo",

            // East Africa
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

            // Southern Africa
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

            // Czech Republic
            "Czech Republic": "Czechia",
            "Czechia": "Czechia",

            // Belarus
            "Belarus": "Belarus",
            "Byelarus": "Belarus",
            "Belorussia": "Belarus",

            // Moldova
            "Moldova": "Moldova",
            "Moldavia": "Moldova",

            // === AMERICAS ===

            // United States
            "United States": "United States of America",
            "USA": "United States of America",
            "US": "United States of America",
            "U.S.A.": "United States of America",

            // Dominican Republic
            "Dominican Republic": "Dominican Rep.",

            // === MIDDLE EAST ===

            // Palestine
            "Palestine": "Palestine",
            "West Bank": "Palestine",
            "Gaza": "Palestine",

            // === ADDITIONAL MAPPINGS ===

            // United Kingdom
            "United Kingdom": "United Kingdom",
            "UK": "United Kingdom",
            "Great Britain": "United Kingdom",

            // === MISSING COUNTRIES FIX ===

            // Bahrain
            "Bahrain": "Bahrain",

            // Comoros
            "Comoros": "Comoros",

            // Kingdom of eSwatini
            "Kingdom of eSwatini (Swaziland)": "eSwatini",

            // Madagascar
            "Madagascar": "Madagascar",
            "Madagascar (Malagasy)": "Madagascar",
            "Malagasy": "Madagascar",

            // North Macedonia (explicit)
            "North Macedonia": "North Macedonia",

            // Solomon Islands
            "Solomon Islands": "Solomon Is."
        };

        const allCountryFeatures = mapGroup.selectAll(".country").data();
        if (manualMapping[countryName]) {
            countryFeature = allCountryFeatures.find(c => c.properties.name === manualMapping[countryName]);
        }
    }

    // 4. If still no match, try careful fuzzy matching
    if (!countryFeature) {
        const allCountryFeatures = mapGroup.selectAll(".country").data();

        // Try partial matching but be careful about substrings (e.g. "Niger" vs "Nigeria")
        countryFeature = allCountryFeatures.find(c => {
            const mapName = c.properties.name;
            // Check if one contains the other
            if (mapName.includes(countryName) || countryName.includes(mapName)) {
                // Verify it's not a completely different country with a similar name
                // e.g. Don't match "Niger" to "Nigeria" if we are looking for "Niger"
                // This is a heuristic; exact matches should have been caught above.

                // If the length difference is large, it might be a wrong match (e.g. "Sudan" vs "South Sudan")
                // unless it's a known abbreviation.
                if (Math.abs(mapName.length - countryName.length) > 10) return false;

                return true;
            }
            return false;
        });
    }

    if (countryFeature) {
        enterCountryView(countryFeature, countryName, d);
    } else {
        console.warn(`No map feature found for country bubble: "${countryName}". Map countries:`,
            mapGroup.selectAll(".country").data().map(c => c.properties.name).sort());
    }
}

function enterCountryView(countryFeature, countryName, countryConflictData, factionFilter = null) {
    // Store previous mode to return to it later
    if (viewState.mode === 'region') {
        viewState.previousMode = 'region';
        viewState.previousRegion = viewState.selectedRegion;
    } else {
        viewState.previousMode = 'world';
        viewState.previousRegion = null;
    }

    viewState.mode = 'country';
    viewState.selectedCountryName = countryName;
    viewState.selectedCountryData = countryConflictData;
    viewState.selectedConflictType = null;
    viewState.selectedFaction = factionFilter; // Store faction filter
    viewState.selectedEvent = null; // Clear any previous event selection

    // Remove any existing capital markers immediately
    bubblesGroup.selectAll(".capital-marker").remove();

    mapGroup.select(".sphere").style("opacity", 0).style("display", "none");
    mapGroup.select(".graticule").style("opacity", 0).style("display", "none");

    // Get neighboring countries
    const neighbors = getNeighboringCountries(countryName);

    // Show selected country and neighbors, keep all visible but dimmed
    mapGroup.selectAll(".country")
        .style("display", "block") // Ensure ALL countries remain visible
        .transition()
        .duration(500)
        .style("opacity", country => {
            const name = country.properties.name;
            if (name === countryName) return 1; // Selected country: full opacity
            if (neighbors.includes(name)) return 0.5; // Neighbors: medium opacity
            return 0.15; // Others: very dim but still visible
        })
        .style("pointer-events", country => {
            const name = country.properties.name;
            // Only selected country and neighbors are clickable
            return (name === countryName || neighbors.includes(name)) ? "auto" : "none";
        });

    zoomToCountry(countryFeature);

    bubblesGroup.selectAll(".conflict-bubble").remove();

    setTimeout(() => {
        drawIndividualEventBubbles();
    }, 600);

    updateLeftPanel();

    d3.select("#charts-panel").style("display", "flex");
    d3.select("#charts-title").text("Statistics & Rankings");

    // Update subtitle to show faction filter if active
    const subtitle = factionFilter
        ? `Filtered by faction: ${factionFilter}`
        : "Comprehensive Data";
    d3.select("#charts-subtitle").text(subtitle);

    d3.select("#reset-zoom").style("display", "block");

    setTimeout(() => {
        updateAllCharts();
    }, 800);

    // DISABLED: Draw Capital Marker (user requested removal)
    // drawCapitalMarker(countryName);
}

// ============================================================================
// FACTION VIEW MODE
// ============================================================================

function enterFactionView(factionId, factionNodeData) {


    // Store previous mode
    if (viewState.mode === 'region') {
        viewState.previousMode = 'region';
        viewState.previousRegion = viewState.selectedRegion;
    } else {
        viewState.previousMode = 'world';
        viewState.previousRegion = null;
    }

    viewState.mode = 'faction';
    viewState.selectedFactionName = factionId;
    viewState.selectedFaction = factionId; // For filter compatibility

    // Step 1: Collect all events involving this faction using optimized index lookup
    const currentYear = +document.getElementById('year-slider').value;
    const filterOptions = { year: currentYear };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }

    let allFactionEvents = dataFilterManager.getFactionEvents(factionId, filterOptions);

    // Store for chart access
    viewState.selectedFactionData = allFactionEvents;

    // Step 2: Determine unique countries
    const countries = [...new Set(allFactionEvents.map(e => e.country))].sort();



    // Step 3: Clear existing bubbles
    bubblesGroup.selectAll("*").remove();

    // Step 4: Intelligent zoom logic
    if (countries.length === 1) {
        // Single country: zoom to that country
        const countryFeature = findCountryFeature(countries[0]);
        if (countryFeature) {
            zoomToCountry(countryFeature);
        }
    } else {
        // Multiple countries: check geographic spread
        const bounds = calculateEventsBounds(allFactionEvents);
        if (bounds && isRegionalCluster(bounds)) {
            // Regional cluster: zoom to bounds
            zoomToBounds(bounds);
        } else {
            // Global dispersion: keep world view
            resetMapZoom();
        }
    }

    // Step 5: Draw faction bubbles based on country count
    if (countries.length === 1) {
        // Single country: draw individual events
        viewState.factionViewLevel = 'country';
        drawFactionBubbles(allFactionEvents);
    } else {
        // Multi-country: draw country aggregated bubbles (like world view)
        viewState.factionViewLevel = 'world';
        drawFactionCountryBubbles(allFactionEvents, countries);
    }

    // Step 6: Update panels and charts
    updateFactionPanel(factionId, allFactionEvents, countries, factionNodeData);

    // Step 7: Show right panel with charts
    d3.select("#charts-panel").style("display", "flex");
    d3.select("#charts-title").text("Faction Statistics");
    d3.select("#charts-subtitle").text(factionId);

    d3.select("#reset-zoom").style("display", "block");

    // Draw charts after a short delay - use displayFactionCharts for consistency
    setTimeout(() => {
        const factionData = {
            id: factionId,
            country: allFactionEvents.length > 0 ? allFactionEvents[0].country : 'Unknown',
            region: factionNodeData?.region || (allFactionEvents.length > 0 ? allFactionEvents[0].region : 'Unknown')
        };
        displayFactionCharts(factionData, allFactionEvents);
    }, 800);
}

function drawFactionBubbles(events) {
    const eventsWithCoords = events.filter(e =>
        e.latitude != null && e.longitude != null
    );

    if (eventsWithCoords.length === 0) return;

    // Scale bubbles by casualties
    const maxCasualties = d3.max(eventsWithCoords, e => e.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [3 / zoomFactor, 20 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    // Enter new bubbles
    const bubbles = bubblesGroup.selectAll(".event-bubble")
        .data(eventsWithCoords, d => d.id || `${d.country}-${d.year}-${d.latitude}-${d.longitude}`)
        .join(
            enter => enter.append("circle")
                .attr("class", "event-bubble")
                .attr("cx", d => projection([d.longitude, d.latitude])[0])
                .attr("cy", d => projection([d.longitude, d.latitude])[1])
                .attr("r", 0)
                .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
                .style("opacity", 0)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    event.stopPropagation();
                    selectEvent(d);
                }),
            update => update,
            exit => exit.remove()
        );

    // Animate bubbles in
    bubbles.transition()
        .duration(800)
        .attr("r", d => radiusScale(d.best))
        .style("opacity", 0.7);
}

// Draw country aggregated bubbles for multi-country faction view (like drawConflictBubbles)
function drawFactionCountryBubbles(events, countries) {
    // Aggregate events by country
    const countryData = [];
    const grouped = d3.group(events, e => e.country);

    grouped.forEach((countryEvents, countryName) => {
        const eventsWithCoords = countryEvents.filter(e => e.latitude && e.longitude);
        if (eventsWithCoords.length === 0) return;

        // Calculate center position (average of all event coordinates)
        const avgLat = d3.mean(eventsWithCoords, e => e.latitude);
        const avgLon = d3.mean(eventsWithCoords, e => e.longitude);

        countryData.push({
            country: countryName,
            coordinates: [avgLon, avgLat],
            casualties: d3.sum(countryEvents, e => e.best),
            eventCount: countryEvents.length,
            region: countryEvents[0].region,
            events: countryEvents
        });
    });

    const maxCasualties = d3.max(countryData, d => d.casualties) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([8 / zoomFactor, 35 / zoomFactor]);

    // D3 data join with enter/exit/update (like global.js drawConflictBubbles)
    const bubbles = bubblesGroup.selectAll(".faction-country-bubble")
        .data(countryData, d => d.country);

    // Exit: fade out
    bubbles.exit()
        .transition().duration(300)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    // Enter: new bubbles
    const enter = bubbles.enter()
        .append("circle")
        .attr("class", "faction-country-bubble")
        .attr("cx", d => projection(d.coordinates)[0])
        .attr("cy", d => projection(d.coordinates)[1])
        .attr("r", 0)
        .style("fill", d => REGION_COLORS[d.region])
        .style("cursor", "pointer")
        .style("opacity", 0)
        .on("click", (event, d) => handleFactionCountryClick(event, d));

    enter.transition().duration(500)
        .attr("r", d => radiusScale(d.casualties))
        .style("opacity", 0.8);

    // Update: resize existing
    bubbles.transition().duration(300)
        .attr("r", d => radiusScale(d.casualties));
}

// Handle click on country bubble in faction view - zoom to that country and show events
function handleFactionCountryClick(event, d) {
    event.stopPropagation();



    // Set selected country in faction
    viewState.selectedCountryInFaction = d.country;
    viewState.factionViewLevel = 'country';

    // Find country feature and zoom
    const countryFeature = findCountryFeature(d.country);
    if (countryFeature) {
        zoomToCountry(countryFeature);
    }

    // Clear country bubbles and draw individual events for this country
    bubblesGroup.selectAll(".faction-country-bubble").remove();

    // Filter events to this country only
    const countryEvents = viewState.selectedFactionData.filter(e => e.country === d.country);
    drawFactionBubbles(countryEvents);
}

// Update country bubble sizes when time slider changes (like updateWorldBubbles)
function updateFactionCountryBubbleSizes(events) {


    // Aggregate by country
    const countryStats = new Map();
    const grouped = d3.group(events, e => e.country);

    grouped.forEach((countryEvents, countryName) => {
        countryStats.set(countryName, {
            casualties: d3.sum(countryEvents, e => e.best),
            eventCount: countryEvents.length
        });
    });

    const maxCasualties = d3.max([...countryStats.values()], d => d.casualties) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([8 / zoomFactor, 35 / zoomFactor]);

    // Update existing country bubbles with smooth transition
    // Try both class names as there are multiple versions of draw function
    let selectedBubbles = bubblesGroup.selectAll(".country-bubble");
    if (selectedBubbles.size() === 0) {
        selectedBubbles = bubblesGroup.selectAll(".faction-country-bubble");
    }


    selectedBubbles
        .transition().duration(300)
        .attr("r", function (d) {
            const stats = countryStats.get(d.country);
            return stats ? radiusScale(stats.casualties) : 0;
        });
}

function updateFactionPanel(factionId, events, countries, factionNodeData) {
    const leftPanel = d3.select("#left-panel");

    // Clear existing content
    leftPanel.selectAll(".country-info-section, .stats-container").remove();
    leftPanel.select("#faction-info-panel").remove();

    // Hide legend sections during faction view
    d3.select(".legend-section").style("display", "none");
    d3.select(".violence-filter-section").style("display", "none");

    const currentYear = +document.getElementById('year-slider').value;
    const currentEvents = events.filter(e => e.year <= currentYear);
    const casualties = d3.sum(currentEvents, e => e.best);

    // Determine region from events or nodeData
    const region = factionNodeData?.region ||
        (currentEvents.length > 0 ? currentEvents[0].region : "Multiple Regions");

    // Create faction info panel (using same styling as displayFactionInfo)
    const factionPanel = leftPanel.insert("div", ":first-child")
        .attr("id", "faction-info-panel")
        .style("padding", "1.5rem")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)")
        .style("border-radius", "8px")
        .style("margin-bottom", "1rem")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    // Title
    const countryFilter = viewState.selectedCountryInFaction;
    const panelTitle = countryFilter
        ? `Faction Details in ${countryFilter}`
        : "Faction Details";

    factionPanel.append("h3")
        .style("margin", "0 0 1rem 0")
        .style("font-size", "1.2rem")
        .style("color", "#1e293b")
        .style("border-bottom", "2px solid #cbd5e1")
        .style("padding-bottom", "0.5rem")
        .text(panelTitle);

    // Faction name box
    factionPanel.append("div")
        .style("margin-bottom", "1rem")
        .style("padding", "0.75rem")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("border-left", `4px solid ${REGION_COLORS[region] || "#64748b"}`)
        .html(`
            <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${factionId}</div>
            <div style="font-size: 0.85rem; color: #64748b;">${countries.length > 1 ? 'Multiple Countries' : countries[0] || 'Unknown'}</div>
        `);

    // Stats grid (2x2)
    const statsGrid = factionPanel.append("div")
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
        .text(d3.format(",d")(currentEvents.length));

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

    // Countries stat
    const countriesStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    countriesStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Countries");
    countriesStat.append("div")
        .style("font-weight", "700")
        .style("color", "#8b5cf6")
        .text(countries.length);

    // Activity Period
    if (currentEvents.length > 0) {
        const years = currentEvents.map(e => e.year);
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

    // Countries Involved with casualties (only if not filtering by country)
    if (!countryFilter && countries.length >= 1) {
        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text(`Countries Involved (${countries.length})`);

        const countriesContainer = factionPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem")
            .style("max-height", "120px")
            .style("overflow-y", "auto");

        const countryStats = countries.map(country => ({
            name: country,
            events: currentEvents.filter(e => e.country === country).length,
            casualties: d3.sum(currentEvents.filter(e => e.country === country), e => e.best)
        })).sort((a, b) => b.casualties - a.casualties);

        countryStats.forEach(country => {
            countriesContainer.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("padding", "0.25rem 0")
                .style("font-size", "0.75rem")
                .style("border-bottom", "1px solid #f1f5f9")
                .html(`
                    <span style="color: #475569;">${country.name}</span>
                    <span style="color: #ef4444; font-weight: 600;">${d3.format(",d")(country.casualties)}</span>
                `);
        });
    }

    // Violence Type Distribution
    if (currentEvents.length > 0) {
        const violenceTypes = d3.rollup(
            currentEvents,
            v => ({ count: v.length, casualties: d3.sum(v, e => e.best) }),
            d => d.type_of_violence_name
        );

        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Violence Type Distribution");

        const violenceContainer = factionPanel.append("div")
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
    }

    // Find deadliest event
    if (currentEvents.length > 0) {
        const deadliestEvent = currentEvents.reduce((max, e) => e.best > max.best ? e : max, currentEvents[0]);

        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Deadliest Event");

        const deadliestContainer = factionPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem");

        deadliestContainer.append("div")
            .style("font-weight", "700")
            .style("color", "#ef4444")
            .style("font-size", "1.1rem")
            .text(`${d3.format(",d")(deadliestEvent.best)} casualties`);

        deadliestContainer.append("div")
            .style("font-size", "0.75rem")
            .style("color", "#64748b")
            .style("margin-top", "0.25rem")
            .html(`
                ${deadliestEvent.dyad_name || 'Unknown'}<br>
                ${deadliestEvent.country} • ${deadliestEvent.date_start || deadliestEvent.year}
            `);
    }
}


// ============================================================================
// FACTION DETAIL VIEW (called from Graph View)
// ============================================================================

/**
 * Enter faction detail view from graph view.
 * This is a wrapper for enterFactionView to provide consistent naming
 * from the graph view context.
 */
function enterFactionDetailView(factionId, factionNodeData) {

    enterFactionView(factionId, factionNodeData);
}

// ============================================================================
// FACTION CHART RENDERING
// ============================================================================

/**
 * Update all charts for faction view with comprehensive visualizations
 */
function updateAllCharts() {


    const events = viewState.selectedFactionData || [];

    if (events.length === 0) {
        console.warn("No faction events data available for charts");
        return;
    }

    // Clear existing charts
    d3.select("#chart-timeline").selectAll("*").remove();
    d3.select("#chart-violence-type").selectAll("*").remove();
    d3.select("#chart-victims").selectAll("*").remove();
    d3.select("#chart-top-events").selectAll("*").remove();

    // Render each chart
    renderFactionTimelineChart(events);
    renderFactionViolenceTypeChart(events);
    renderFactionVictimChart(events);
    renderFactionTopEvents(events);
}

/**
 * Render timeline chart showing casualties over time
 */
function renderFactionTimelineChart(events) {
    const container = d3.select("#chart-timeline");
    const width = 400;
    const height = 180;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    const svg = container
        .attr("width", width)
        .attr("height", height);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate by year
    const yearData = d3.rollup(
        events,
        v => d3.sum(v, d => d.best),
        d => d.year
    );

    const data = Array.from(yearData, ([year, casualties]) => ({ year, casualties }))
        .sort((a, b) => a.year - b.year);

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.casualties)])
        .nice()
        .range([chartHeight, 0]);

    // Line
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.casualties))
        .curve(d3.curveMonotoneX);

    // Area
    const area = d3.area()
        .x(d => x(d.year))
        .y0(chartHeight)
        .y1(d => y(d.casualties))
        .curve(d3.curveMonotoneX);

    // Draw area
    g.append("path")
        .datum(data)
        .attr("fill", "rgba(239, 68, 68, 0.2)")
        .attr("d", area);

    // Draw line
    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Axes
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(5))
        .style("font-size", "10px");

    g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .style("font-size", "10px");
}

/**
 * Render violence type distribution pie chart
 */
function renderFactionViolenceTypeChart(events) {
    const container = d3.select("#chart-violence-type");
    const width = 400;
    const height = 180;
    const radius = Math.min(width, height) / 2 - 10;

    container
        .attr("width", width)
        .attr("height", height);

    const g = container.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const data = d3.rollup(
        events,
        v => v.length,
        d => d.type_of_violence_name
    );

    const pie = d3.pie()
        .value(d => d[1])
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius);

    const arcs = g.selectAll(".arc")
        .data(pie(Array.from(data)))
        .join("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => TYPE_COLORS[d.data[0]] || "#64748b")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "white")
        .style("font-weight", "600")
        .text(d => d.data[1] > 5 ? d.data[1] : "");
}

/**
 * Render victim composition pie chart
 */
function renderFactionVictimChart(events) {
    const container = d3.select("#chart-victims");
    const width = 400;
    const height = 180;
    const radius = Math.min(width, height) / 2 - 10;

    container
        .attr("width", width)
        .attr("height", height);

    const g = container.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const civilianCasualties = d3.sum(events, e => (e.deaths_civilians || 0));
    const combatantCasualties = d3.sum(events, e => (e.deaths_a || 0) + (e.deaths_b || 0));
    const unknownCasualties = d3.sum(events, e => (e.deaths_unknown || 0));

    const data = [
        { label: "Civilians", value: civilianCasualties, color: "#ef4444" },
        { label: "Combatants", value: combatantCasualties, color: "#f59e0b" },
        { label: "Unknown", value: unknownCasualties, color: "#94a3b8" }
    ].filter(d => d.value > 0);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius);

    const arcs = g.selectAll(".arc")
        .data(pie(data))
        .join("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => d.data.color)
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "white")
        .style("font-weight", "600")
        .text(d => d.data.value > 50 ? d3.format(",")(d.data.value) : "");
}

/**
 * Render top events list
 */
function renderFactionTopEvents(events) {
    const container = d3.select("#chart-top-events");
    container.selectAll("*").remove();

    const topEvents = events
        .sort((a, b) => b.best - a.best)
        .slice(0, 10);

    topEvents.forEach((event, idx) => {
        const item = container.append("div")
            .attr("class", "event-item")
            .style("cursor", "pointer")
            .on("click", () => {
                selectEvent(event);
            });

        item.append("div")
            .attr("class", "event-item-title")
            .text(`${idx + 1}. ${event.country} - ${event.dyad_name || "Conflict"}`);

        item.append("div")
            .attr("class", "event-item-meta")
            .html(`
                ${event.date_start || event.year} • 
                <strong style="color: #ef4444;">${d3.format(",")(event.best)} casualties</strong> • 
                ${event.type_of_violence_name}
            `);
    });
}

function drawCapitalMarker(countryName) {
    const info = countryInfoMap.get(countryName);
    if (!info || !info.capitalCoords) return;

    const [lon, lat] = info.capitalCoords;
    const projected = projection([lon, lat]);

    if (!projected) return;

    // Calculate star size based on LARGEST EVENT BUBBLE in this country
    const zoomFactor = viewState.zoomScale || 1;
    let starSize = 10; // Default size in pixels

    if (viewState.selectedCountryData) {
        const currentYear = +document.getElementById('year-slider').value;

        // Get events for this country
        let events = viewState.selectedCountryData.eventsWithCoords.filter(e => e.year <= currentYear);

        if (events.length > 0) {
            // Find the largest individual event (not total casualties)
            const maxEventCasualties = d3.max(events, d => d.best);

            // Use the SAME scaling as individual event bubbles
            const baseRange = [3 / zoomFactor, 20 / zoomFactor];
            const radiusScale = d3.scaleSqrt()
                .domain([0, maxEventCasualties])
                .range(baseRange);

            // Calculate the radius of the largest event bubble
            const largestBubbleRadius = radiusScale(maxEventCasualties);

            // Make star smaller: 30% of largest bubble
            // Reduced size to not overwhelm small countries
            starSize = Math.max(5, Math.min(12, largestBubbleRadius * 0.3));
        }
    }

    const g = bubblesGroup.append("g")
        .attr("class", "capital-marker")
        .attr("data-country", countryName) // Store country name for updates
        .attr("transform", `translate(${projected[0]}, ${projected[1]})`)
        .style("opacity", 0)
        .style("cursor", "pointer");

    // Star Icon with dynamic size and tooltip
    g.append("text")
        .attr("class", "capital-star")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", `${starSize}px`)
        .text("★")
        .append("title")
        .text(info.capital); // Tooltip shows capital name on hover

    g.transition().duration(800).style("opacity", 1);
}

// Update capital marker size on zoom
function updateCapitalMarkerSize() {
    const zoomFactor = viewState.zoomScale || 1;

    bubblesGroup.selectAll(".capital-marker")
        .each(function () {
            const marker = d3.select(this);
            const countryName = marker.attr("data-country");

            let starSize = 10; // Default size

            if (viewState.selectedCountryData && viewState.selectedCountryName === countryName) {
                const currentYear = +document.getElementById('year-slider').value;
                let events = viewState.selectedCountryData.eventsWithCoords.filter(e => e.year <= currentYear);

                if (events.length > 0) {
                    const maxEventCasualties = d3.max(events, d => d.best);
                    const baseRange = [3 / zoomFactor, 20 / zoomFactor];
                    const radiusScale = d3.scaleSqrt()
                        .domain([0, maxEventCasualties])
                        .range(baseRange);

                    const largestBubbleRadius = radiusScale(maxEventCasualties);
                    starSize = Math.max(5, Math.min(12, largestBubbleRadius * 0.3));
                }
            }

            marker.select(".capital-star")
                .transition()
                .duration(100)
                .style("font-size", `${starSize}px`);
        });
}

function zoomToCountry(countryFeature) {
    if (!countryFeature) return;

    const bounds = path.bounds(countryFeature);

    // Validate bounds to prevent errors
    if (!bounds || !bounds[0] || !bounds[1] ||
        !isFinite(bounds[0][0]) || !isFinite(bounds[0][1]) ||
        !isFinite(bounds[1][0]) || !isFinite(bounds[1][1])) {
        console.warn("Invalid bounds for country:", countryFeature.properties?.name);
        return;
    }

    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    // Prevent division by zero or infinite scale
    if (dx === 0 || dy === 0) return;

    const scale = Math.max(2, Math.min(300, 0.9 / Math.max(dx / mapWidth, dy / mapHeight)));

    viewState.zoomScale = scale;

    const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// ============================================================================
// FACTION VIEW ZOOM HELPERS
// ============================================================================

// Calculate geographic bounds of events
function calculateEventsBounds(events) {
    const coordEvents = events.filter(e => e.latitude != null && e.longitude != null);
    if (coordEvents.length === 0) return null;

    const lons = coordEvents.map(e => e.longitude);
    const lats = coordEvents.map(e => e.latitude);

    return {
        minLon: d3.min(lons),
        maxLon: d3.max(lons),
        minLat: d3.min(lats),
        maxLat: d3.max(lats)
    };
}

// Check if events form a regional cluster (not globally dispersed)
function isRegionalCluster(bounds) {
    if (!bounds) return false;

    const lonSpan = bounds.maxLon - bounds.minLon;
    const latSpan = bounds.maxLat - bounds.minLat;

    // If events span < 60 degrees lon/lat, consider it regional
    return lonSpan < 60 && latSpan < 60;
}

// Zoom to geographic bounds
function zoomToBounds(bounds) {
    if (!bounds) return;

    // Project bounds to screen coordinates
    const p1 = projection([bounds.minLon, bounds.minLat]);
    const p2 = projection([bounds.maxLon, bounds.maxLat]);

    if (!p1 || !p2) return;

    const dx = Math.abs(p2[0] - p1[0]);
    const dy = Math.abs(p2[1] - p1[1]);
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;

    // Calculate appropriate zoom scale with padding
    const scale = Math.max(1.2, Math.min(8, 0.8 / Math.max(dx / mapWidth, dy / mapHeight)));
    const translate = [mapWidth / 2 - scale * cx, mapHeight / 2 - scale * cy];

    viewState.zoomScale = scale;

    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

// Reset map zoom to world view
function resetMapZoom() {
    viewState.zoomScale = 1;

    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
}


function exitCountryView() {
    // ========================================================================
    // COMPREHENSIVE CLEANUP - Ensure ALL bubble/marker types are removed
    // ========================================================================
    bubblesGroup.selectAll(".event-bubble").remove();
    bubblesGroup.selectAll(".capital-marker").remove();
    bubblesGroup.selectAll(".conflict-bubble").remove();
    bubblesGroup.selectAll("circle").remove(); // Remove any orphaned circles
    bubblesGroup.selectAll("*").remove(); // Complete cleanup of bubbles group

    // Check if we should return to region view
    if (viewState.previousMode === 'region' && viewState.previousRegion) {
        // Clean up country-specific charts
        d3.select("#chart-heatmap-container").remove();
        d3.select("#chart-victims").classed("h-320", false);

        // Restore region view
        toggleRegion(viewState.previousRegion);
        return;
    }

    // ========================================================================
    // RESET ALL VIEW STATE PROPERTIES - Return to pristine world view
    // ========================================================================
    viewState.mode = 'world';
    viewState.selectedCountryName = null;
    viewState.selectedCountryData = null;
    viewState.selectedConflictType = null;
    viewState.selectedEvent = null;
    viewState.selectedRegion = null; // Clear region filter
    viewState.selectedViolenceType = null; // Clear violence type filter
    viewState.selectedFaction = null; // Clear faction filter
    viewState.previousMode = null; // Clear previous mode tracking
    viewState.previousRegion = null; // Clear previous region tracking
    viewState.zoomScale = 1;

    // ========================================================================
    // RESET ZOOM TO IDENTITY - Return to default zoom level
    // ========================================================================
    svg.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);

    // ========================================================================
    // RESTORE SPHERE AND GRATICULE - Show global map elements
    // ========================================================================
    mapGroup.select(".sphere")
        .style("display", "block")
        .transition()
        .duration(300)
        .style("opacity", 1);

    mapGroup.select(".graticule")
        .style("display", "block")
        .transition()
        .duration(300)
        .style("opacity", 0.1); // FIXED: World view uses 0.1 opacity, not 1

    // ========================================================================
    // RESTORE ALL COUNTRIES - Full opacity and clickable
    // ========================================================================
    mapGroup.selectAll(".country")
        .style("display", "block")
        .style("pointer-events", "auto")
        .transition()
        .duration(300)
        .style("opacity", 1)
        .style("stroke-width", null) // Clear any custom stroke width
        .style("stroke", null); // Clear any custom stroke color

    // ========================================================================
    // RESET LEFT PANEL - Remove country-specific sections
    // ========================================================================
    resetLeftPanel();

    // ========================================================================
    // REMOVE ALL COUNTRY-SPECIFIC CHARTS AND ELEMENTS
    // ========================================================================
    d3.select("#chart-heatmap-container").remove();
    d3.select("#chart-victims").classed("h-320", false);
    d3.select("#country-info-section").remove();
    d3.select("#stats-overview-section").remove();
    d3.select("#country-name-section").remove();
    d3.select("#pie-chart-section").remove();

    // ========================================================================
    // SHOW TOP COUNTRIES PANEL - Restore world view right panel
    // ========================================================================
    d3.select("#charts-panel").style("display", "flex");
    d3.select("#charts-title").text("Top Countries");
    d3.select("#charts-subtitle").text("Comprehensive Statistics");

    // ========================================================================
    // HIDE BACK BUTTON - Only shown in country/region view
    // ========================================================================
    d3.select("#reset-zoom").style("display", "none");

    // ========================================================================
    // RESET LEGEND AND FILTERS - All regions/types active
    // ========================================================================
    d3.selectAll(".legend-item").classed("active", true).classed("selected", false);
    d3.selectAll("#violence-type-filter .legend-item").classed("selected", false);

    // ========================================================================
    // UPDATE STATS FOR WORLD VIEW - Calculate global statistics
    // ========================================================================
    updateStats();

    // ========================================================================
    // REDRAW WORLD BUBBLES - Show global conflict data
    // Use setTimeout to ensure ALL DOM cleanup is complete
    // ========================================================================
    setTimeout(() => {
        drawConflictBubbles();
        renderTopCountriesList();
    }, 150); // Slightly longer delay to ensure complete cleanup
}


// Smart back button handler - handles both focus mode and country view
d3.select("#reset-zoom").on("click", function () {
    // Check if we're in graph focus mode
    if (graphViewActive && graphFilterState.focusedFaction) {
        clearFocusMode();
        return;
    }
    // Otherwise, exit country view
    exitCountryView();
});

// ============================================================================
// LEFT PANEL UPDATES
// ============================================================================

function updateLeftPanel() {
    if (!viewState.selectedCountryData) return;

    const data = viewState.selectedCountryData;
    const currentYear = +document.getElementById('year-slider').value;
    const filteredEvents = data.events.filter(e => e.year <= currentYear);

    const info = countryInfoMap.get(data.name) || { population: 'N/A', area: 'N/A' };

    // Calculate current year statistics
    const currentCasualties = d3.sum(filteredEvents, e => e.best);
    const currentEvents = filteredEvents.length;

    // Calculate most frequent opponent
    const opponents = {};
    filteredEvents.forEach(event => {
        const opponent = event.side_b || 'Unknown';
        opponents[opponent] = (opponents[opponent] || 0) + 1;
    });
    const mostFrequentOpponent = Object.entries(opponents)
        .sort((a, b) => b[1] - a[1])[0];

    // Calculate casualty composition
    const casualties = {
        side_a: d3.sum(filteredEvents, e => e.deaths_a),
        side_b: d3.sum(filteredEvents, e => e.deaths_b),
        civilians: d3.sum(filteredEvents, e => e.deaths_civilians),
        unknown: d3.sum(filteredEvents, e => e.deaths_unknown)
    };

    d3.select(".legend-section").style("display", "none");
    d3.select(".stats-container").style("display", "none");

    // Add country name at the top
    if (!d3.select("#country-name-section").node()) {
        d3.select(".left-panel")
            .insert("div", ".reset-btn")
            .attr("id", "country-name-section")
            .style("margin-bottom", "1rem")
            .html(`
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--accent-primary); margin-bottom: 0.5rem;">${viewState.selectedCountryName}</h2>
            `);
    } else {
        d3.select("#country-name-section h2").text(viewState.selectedCountryName);
    }

    if (!d3.select("#country-info-section").node()) {
        d3.select(".left-panel")
            .insert("div", ".reset-btn")
            .attr("id", "country-info-section")
            .html(`
                <h3>Country Information</h3>
                <div id="country-info-content"></div>
            `);
    }

    d3.select("#country-info-content").html(`
        <div class="country-info-item">
            <span class="country-info-label">Capital:</span>
            <span class="country-info-value">${info.capital || 'N/A'}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Population:</span>
            <span class="country-info-value">${info.population}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Area:</span>
            <span class="country-info-value">${info.area}</span>
        </div>
        <div class="country-info-item" style="border-bottom: none;">
            <span class="country-info-label">Region:</span>
            <span class="country-info-value">${data.region}</span>
        </div>
    `);

    // Add statistics overview section
    if (!d3.select("#stats-overview-section").node()) {
        d3.select(".left-panel")
            .insert("div", ".reset-btn")
            .attr("id", "stats-overview-section")
            .html(`
                <h3>Overview Statistics</h3>
                <div id="stats-overview-content"></div>
            `);
    }

    d3.select("#stats-overview-content").html(`
        <div class="country-info-item">
            <span class="country-info-label">Total Events:</span>
            <span class="country-info-value">${d3.format(",d")(currentEvents)}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Total Casualties:</span>
            <span class="country-info-value" style="color: #ef4444;">${d3.format(",d")(currentCasualties)}</span>
        </div>
        <div class="country-info-item" style="border-bottom: none; display: block; padding-bottom: 0.5rem;">
            <div id="casualty-stacked-bar" style="margin-top: 0.5rem;"></div>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Deadliest Conflict:</span>
            <span class="country-info-value" style="color: #ef4444;">${d3.format(",d")(data.deadliestEvent.best)} casualties</span>
        </div>
        <div class="country-info-item" style="border-bottom: none;">
            <span class="country-info-label" style="font-size: 0.75rem; color: #64748b;">
                ${data.deadliestEvent.dyad_name || 'Unknown'}<br>
                ${data.deadliestEvent.date_start || data.deadliestEvent.year}
            </span>
        </div>
        ${mostFrequentOpponent ? `
        <div class="country-info-item" style="border-bottom: none;">
            <span class="country-info-label">Main Opponent:</span>
            <span class="country-info-value">${mostFrequentOpponent[0]} (${mostFrequentOpponent[1]} conflicts)</span>
        </div>
        ` : ''}
    `);

    // Draw stacked bar chart
    drawCasualtyStackedBar(casualties, currentCasualties);
}

function drawCasualtyStackedBar(casualties, total) {
    const container = d3.select("#casualty-stacked-bar");
    container.html('');

    const width = container.node().getBoundingClientRect().width || 240;
    const height = 30;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const colors = {
        side_a: '#d62728',
        side_b: '#1f77b4',
        civilians: '#2ca02c',
        unknown: '#7f7f7f'
    };

    const labels = {
        side_a: 'Country',
        side_b: 'Opponent',
        civilians: 'Civilians',
        unknown: 'Unknown'
    };

    let x = 0;
    Object.entries(casualties).forEach(([key, value]) => {
        if (value > 0) {
            const barWidth = (value / total) * width;

            svg.append("rect")
                .attr("x", x)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", height)
                .attr("fill", colors[key])
                .attr("rx", 2)
                .append("title")
                .text(`${labels[key]}: ${d3.format(",d")(value)} (${d3.format(".1%")(value / total)})`);

            x += barWidth;
        }
    });

    // Add legend below
    const legend = container.append("div")
        .style("display", "flex")
        .style("gap", "8px")
        .style("margin-top", "5px")
        .style("flex-wrap", "wrap");

    Object.entries(casualties).forEach(([key, value]) => {
        if (value > 0) {
            const item = legend.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "4px")
                .style("font-size", "0.7rem");

            item.append("div")
                .style("width", "10px")
                .style("height", "10px")
                .style("background", colors[key])
                .style("border-radius", "2px");

            item.append("span")
                .style("color", "#94a3b8")
                .text(labels[key]);
        }
    });
}

function resetLeftPanel() {
    // Remove all country-specific sections
    d3.select("#country-name-section").remove();
    d3.select("#country-info-section").remove();
    d3.select("#stats-overview-section").remove();
    d3.select("#pie-chart-section").remove();

    // Also clear any remaining country data from left panel
    d3.select("#left-panel").selectAll(".country-view-section").remove();

    // Restore world view sections
    d3.select(".legend-section").style("display", "block");
    d3.select(".stats-container").style("display", "block");
    updateStats();
}

// ============================================================================
// STATISTICAL CHARTS
// ============================================================================

function getFilteredData() {
    // In faction mode, return faction events
    if (viewState.mode === 'faction' && viewState.selectedFactionData) {
        const currentYear = +document.getElementById('year-slider').value;
        let data = viewState.selectedFactionData.filter(d => d.year <= currentYear);

        if (viewState.selectedConflictType) {
            data = data.filter(d => d.type_of_violence_name === viewState.selectedConflictType);
        }

        return data;
    }

    // Existing country view logic
    if (!viewState.selectedCountryData) return [];

    let data = viewState.selectedCountryData.events;
    const currentYear = +document.getElementById('year-slider').value;

    data = data.filter(d => d.year <= currentYear);

    if (viewState.selectedConflictType) {
        data = data.filter(d => d.type_of_violence_name === viewState.selectedConflictType);
    }

    // Apply faction filter if active (from graph view)
    if (viewState.selectedFaction && viewState.mode !== 'faction') {
        data = data.filter(e => {
            const factionName = viewState.selectedFaction;
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(factionName) || sideB.includes(factionName);
        });
    }

    return data;
}

function updateAllCharts() {
    if (viewState.mode === 'world') {
        renderTopCountriesList();
    } else if (viewState.mode === 'country' || viewState.mode === 'faction') {
        // Restore standard charts for both country and faction views
        d3.select("#charts-panel").selectAll(".chart-container").style("display", "block");
        d3.select("#top-countries-list").style("display", "none");
        d3.select("#event-text-details").style("display", "none");
        d3.select("#victim-chart-container").style("display", "none"); // Hide event-specific victim chart

        drawTimelineChart();
        drawViolenceTypeChart();
        drawYearMonthHeatmap(); // Year-Month Heatmap instead of donut chart
        renderTopEventsList();
    } else if (viewState.mode === 'event') {
        renderEventDetailsView(viewState.selectedEvent);
    }
}

function renderTopCountriesList() {
    const container = d3.select("#charts-panel");
    container.style("display", "flex");
    d3.select("#charts-title").text("Top Countries");
    d3.select("#charts-subtitle").text("Comprehensive Statistics");

    // Clear existing charts
    d3.select("#chart-timeline").selectAll("*").remove();
    d3.select("#chart-violence-type").selectAll("*").remove();
    d3.select("#chart-victims").selectAll("*").remove();
    d3.select("#chart-top-events").html('');

    // Hide unused chart containers
    container.selectAll(".chart-container").style("display", "none");

    // Create or select Top Countries container
    let listContainer = container.select("#top-countries-list");
    if (listContainer.empty()) {
        listContainer = container.append("div")
            .attr("id", "top-countries-list")
            .attr("class", "chart-container")
            .style("display", "block");

        // Sorting Controls
        const controls = listContainer.append("div")
            .attr("class", "sort-controls")
            .style("display", "flex")
            .style("gap", "10px")
            .style("margin-bottom", "15px");

        const modes = [
            { id: 'casualties', label: 'Casualties' },
            { id: 'count', label: 'Conflicts' },
            { id: 'average', label: 'Average' }
        ];

        modes.forEach(mode => {
            controls.append("button")
                .attr("class", "sort-btn")
                .attr("data-mode", mode.id)
                .text(mode.label)
                .style("padding", "5px 10px")
                .style("border-radius", "4px")
                .style("border", "none")
                .style("cursor", "pointer")
                .style("background", "#334155")
                .style("color", "white")
                .style("font-size", "0.75rem")
                .on("click", function () {
                    viewState.countrySortMode = mode.id;
                    renderTopCountriesList(); // Re-render
                });
        });

        listContainer.append("div").attr("class", "events-list");
    } else {
        listContainer.style("display", "block");
    }

    // Update active button state
    listContainer.selectAll(".sort-btn")
        .style("background", function () { return this.getAttribute("data-mode") === viewState.countrySortMode ? "#2563eb" : "#334155"; })
        .style("opacity", function () { return this.getAttribute("data-mode") === viewState.countrySortMode ? "1" : "0.7"; });

    const currentYear = +document.getElementById('year-slider').value;

    // Aggregate data by country for current year
    // Filter by region if in region view mode
    let countriesData = processedData;
    if (viewState.mode === 'region' && viewState.selectedRegion) {
        countriesData = processedData.filter(c => c.region === viewState.selectedRegion);
        d3.select("#charts-subtitle").text(`${viewState.selectedRegion} - Comprehensive Statistics`);
    }

    const countryStats = countriesData.map(c => {
        const events = c.events.filter(e => e.year <= currentYear);
        const casualties = d3.sum(events, e => e.best);
        const count = events.length;
        return {
            name: c.name,
            region: c.region,
            casualties: casualties,
            count: count,
            average: count > 0 ? casualties / count : 0
        };
    })
        .filter(c => c.count > 0) // Only show countries with events
        .sort((a, b) => b[viewState.countrySortMode] - a[viewState.countrySortMode])
        .slice(0, 10);

    const list = listContainer.select(".events-list");
    list.html('');

    countryStats.forEach((c, i) => {
        const item = list.append("div")
            .attr("class", "event-item")
            .style("border-left-color", REGION_COLORS[c.region])
            .on("click", () => {
                // Use country data directly since we already have it from processedData
                const countryConflictData = processedData.find(country => country.name === c.name);
                if (!countryConflictData) {
                    console.warn(`No conflict data for: "${c.name}"`);
                    return;
                }

                // Find the map feature for visualization
                const countryFeature = findCountryFeature(c.name);
                if (countryFeature) {
                    // Directly enter country view with the data we have
                    enterCountryView(countryFeature, countryConflictData.name, countryConflictData);
                } else {
                    console.warn(`Could not find map feature for country: "${c.name}"`);
                }
            })
            .on("mouseenter", () => {
                // Highlight country on map using same matching logic
                const countryFeature = findCountryFeature(c.name);
                if (countryFeature) {
                    mapGroup.selectAll(".country")
                        .filter(f => f === countryFeature)
                        .style("stroke", "#fbbf24")
                        .style("stroke-width", "2px");
                }
            })
            .on("mouseleave", () => {
                // Remove highlight
                const countryFeature = findCountryFeature(c.name);
                if (countryFeature) {
                    mapGroup.selectAll(".country")
                        .filter(f => f === countryFeature)
                        .style("stroke", "#334155")
                        .style("stroke-width", "0.5px");
                }
            });

        item.append("div")
            .attr("class", "event-item-title")
            .text(`${i + 1}. ${c.name}`);

        let metaText = "";
        if (viewState.countrySortMode === 'casualties') {
            metaText = `<strong style="color: ${REGION_COLORS[c.region]};">${d3.format(",d")(c.casualties)}</strong> casualties`;
        } else if (viewState.countrySortMode === 'count') {
            metaText = `<strong style="color: ${REGION_COLORS[c.region]};">${c.count}</strong> conflicts`;
        } else {
            metaText = `<strong style="color: ${REGION_COLORS[c.region]};">${d3.format(",.1f")(c.average)}</strong> avg casualties`;
        }

        item.append("div")
            .attr("class", "event-item-meta")
            .html(metaText);
    });
}

function renderTopOpponentsList() {
    const container = d3.select("#charts-panel");

    // Create or select Top Opponents container
    let listContainer = container.select("#top-opponents-list");
    if (listContainer.empty()) {
        listContainer = container.insert("div", "#chart-top-events") // Insert before top events
            .attr("id", "top-opponents-list")
            .attr("class", "chart-container")
            .style("display", "block");
        listContainer.append("h4").text("Main Opponents (Side B)");
        listContainer.append("div").attr("class", "events-list");
    } else {
        listContainer.style("display", "block");
    }

    const data = getFilteredData();
    const opponents = d3.rollup(data, v => d3.sum(v, d => d.best), d => d.side_b);
    const topOpponents = Array.from(opponents, ([name, val]) => ({ name, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);

    const list = listContainer.select(".events-list");
    list.html('');

    topOpponents.forEach((o, i) => {
        list.append("div")
            .attr("class", "event-item")
            .style("border-left-color", REGION_COLORS[viewState.selectedCountryData.region])
            .html(`
                <div class="event-item-title">${i + 1}. ${o.name}</div>
                <div class="event-item-meta">
                    <strong style="color: #ef4444;">${d3.format(",d")(o.val)}</strong> casualties
                </div>
            `);
    });
}

// Chart 1: Timeline
function drawTimelineChart() {
    const data = getFilteredData();
    if (data.length === 0) return;

    const yearData = d3.rollup(
        data,
        v => d3.sum(v, d => d.best),
        d => d.year
    );

    const chartData = Array.from(yearData, ([year, casualties]) => ({ year, casualties }))
        .sort((a, b) => a.year - b.year);

    const svg = d3.select("#chart-timeline");
    svg.selectAll("*").remove();

    const chartNode = d3.select("#chart-timeline").node();
    if (!chartNode || !chartNode.parentElement) {
        console.warn("Timeline chart container not found");
        return;
    }
    const container = chartNode.parentElement;
    const width = container.getBoundingClientRect().width || 300;
    const height = 180;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(chartData, d => d.year))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.casualties)])
        .range([innerHeight, 0]);

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.casualties))
        .curve(d3.curveMonotoneX);

    const area = d3.area()
        .x(d => x(d.year))
        .y0(innerHeight)
        .y1(d => y(d.casualties))
        .curve(d3.curveMonotoneX);

    g.append("path")
        .datum(chartData)
        .attr("fill", "rgba(59, 130, 246, 0.2)")
        .attr("d", area);

    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2)
        .attr("d", line);

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")))
        .style("color", "#94a3b8")
        .style("font-size", "0.75rem");

    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")))
        .style("color", "#94a3b8")
        .style("font-size", "0.75rem");
}

// Chart 2: Violence Type Breakdown (Pie Chart)
function drawViolenceTypeChart() {
    const data = getFilteredData();
    if (data.length === 0) return;

    const typeData = d3.rollup(
        data,
        v => d3.sum(v, d => d.best),
        d => d.type_of_violence_name
    );

    const chartData = Array.from(typeData, ([type, casualties]) => ({ type, casualties }))
        .filter(d => d.casualties > 0)
        .sort((a, b) => b.casualties - a.casualties);

    const svg = d3.select("#chart-violence-type");
    svg.selectAll("*").remove();

    const container = d3.select("#chart-violence-type").node().parentElement;
    const width = container.getBoundingClientRect().width || 300;
    const height = 200;
    const radius = Math.min(width, height) / 2 - 20;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3.pie()
        .value(d => d.casualties)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius * 0.85);

    const arcs = g.selectAll("arc")
        .data(pie(chartData))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => TYPE_COLORS[d.data.type] || "#94a3b8")
        .attr("stroke", "#f8fafc")
        .style("stroke-width", "2px")
        .style("opacity", 0.85)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 1).style("stroke", "#fff").style("stroke-width", "3px");
            g.append("text")
                .attr("class", "center-text")
                .attr("text-anchor", "middle")
                .attr("dy", "-0.5em")
                .style("fill", "#1e293b")
                .style("font-weight", "bold")
                .style("font-size", "0.9rem")
                .text(d.data.type);
            g.append("text")
                .attr("class", "center-text")
                .attr("text-anchor", "middle")
                .attr("dy", "1em")
                .style("fill", "#64748b")
                .style("font-size", "0.8rem")
                .text(d3.format(",d")(d.data.casualties));
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 0.85).style("stroke", "#f8fafc").style("stroke-width", "2px");
            g.selectAll(".center-text").remove();
        });

    // Add legend
    const legend = g.append("g")
        .attr("transform", `translate(${-width / 2 + 10}, ${-height / 2 + 10})`);

    chartData.forEach((d, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 18})`);

        legendRow.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", TYPE_COLORS[d.type] || "#94a3b8")
            .attr("rx", 2);

        legendRow.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .style("fill", "#64748b")
            .style("font-size", "0.65rem")
            .text(d.type);
    });
}

// Chart 3: Year-Month Heatmap (Conflict Intensity) - Replaces Victim Composition in Country View
function drawYearMonthHeatmap() {
    const data = getFilteredData();
    if (data.length === 0) return;

    // Filter out data without valid month information
    const validData = data.filter(d => d.month !== null && d.month >= 1 && d.month <= 12);

    if (validData.length === 0) {
        console.warn("No valid month data available for heatmap");
        return;
    }

    // Use the existing chart-victims container from HTML
    const chartContainer = d3.select("#chart-victims").node()?.parentElement;
    if (!chartContainer) {
        console.error("chart-victims container not found");
        return;
    }

    // Add height expansion class
    d3.select("#chart-victims").classed("h-320", true);

    // Update the title
    d3.select(chartContainer).select("h4").text("Conflict Intensity (Year-Month)");

    const svg = d3.select("#chart-victims");
    svg.selectAll("*").remove();

    // Aggregate data by year and month
    const heatmapData = d3.rollup(
        validData,
        v => d3.sum(v, d => d.best),
        d => d.year,
        d => d.month
    );

    const years = Array.from(new Set(validData.map(d => d.year))).sort((a, b) => a - b);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const width = chartContainer.getBoundingClientRect().width || 380;
    const height = 320; // Set to 320px explicitly
    const margin = { top: 10, right: 15, bottom: 70, left: 60 }; // Increased left margin for full month names
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const cellWidth = innerWidth / years.length;
    const cellHeight = innerHeight / 12;

    // Prepare data array
    const dataArray = [];
    years.forEach(year => {
        for (let month = 1; month <= 12; month++) {
            const casualties = heatmapData.get(year)?.get(month) || 0;
            dataArray.push({ year, month, casualties });
        }
    });

    const maxCasualties = d3.max(dataArray, d => d.casualties) || 1;

    const colorScale = d3.scaleSequential()
        .domain([0, maxCasualties])
        .interpolator(d3.interpolateYlOrRd);

    // Draw cells
    g.selectAll("rect")
        .data(dataArray)
        .join("rect")
        .attr("x", d => years.indexOf(d.year) * cellWidth)
        .attr("y", d => (d.month - 1) * cellHeight)
        .attr("width", cellWidth - 1)
        .attr("height", cellHeight - 1)
        .attr("fill", d => d.casualties > 0 ? colorScale(d.casualties) : "#f1f5f9")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .append("title")
        .text(d => `${months[d.month - 1]} ${d.year}: ${d3.format(",d")(d.casualties)} casualties`);

    // Y-axis (Months)
    const yAxis = d3.axisLeft(d3.scaleBand()
        .domain(months)
        .range([0, innerHeight]))
        .tickSize(0);

    g.append("g")
        .call(yAxis)
        .selectAll("text")
        .style("fill", "#64748b")
        .style("font-size", "0.65rem");

    // X-axis (Years) - show years every 5 years
    const xAxis = d3.axisBottom(d3.scaleBand()
        .domain(years)
        .range([0, innerWidth]))
        .tickValues(years.filter(y => y % 5 === 0))
        .tickSize(0);

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("fill", "#64748b")
        .style("font-size", "0.55rem") // Slightly smaller font for all years
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    g.selectAll(".domain").remove();
}

// Chart 5: Seasonality of Conflict (New)
function drawSeasonalityChart() {
    const data = getFilteredData();
    if (data.length === 0) return;

    // Aggregate by month (1-12)
    const monthData = d3.rollup(
        data,
        v => d3.sum(v, d => d.best),
        d => d.month
    );

    // Ensure all months are present
    const chartData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 1; i <= 12; i++) {
        chartData.push({
            month: months[i - 1],
            monthNum: i,
            casualties: monthData.get(i) || 0
        });
    }

    const container = d3.select("#charts-panel");
    let chartContainer = container.select("#chart-seasonality-container");

    if (chartContainer.empty()) {
        chartContainer = container.append("div") // Append instead of insert to avoid reference issues
            .attr("id", "chart-seasonality-container")
            .attr("class", "chart-container")
            .style("display", "block");
        chartContainer.append("h4").text("Seasonality of Conflict");
        chartContainer.append("svg").attr("id", "chart-seasonality");
    } else {
        chartContainer.style("display", "block");
    }

    const svg = d3.select("#chart-seasonality");
    svg.selectAll("*").remove();

    const width = chartContainer.node().getBoundingClientRect().width || 300;
    const height = 180;
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(months)
        .range([0, innerWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.casualties)])
        .range([innerHeight, 0]);

    // Add gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "seasonality-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#f59e0b"); // Amber
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ef4444"); // Red

    g.selectAll(".bar")
        .data(chartData)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.month))
        .attr("y", d => y(d.casualties))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.casualties))
        .attr("fill", "url(#seasonality-gradient)")
        .attr("rx", 2);

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("color", "#94a3b8")
        .style("font-size", "0.65rem");

    g.append("g")
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2s")))
        .style("color", "#94a3b8")
        .style("font-size", "0.7rem");

    g.select(".domain").remove();
}

// Chart 4: Top Events (Renamed to Top Conflicts)
function renderTopEventsList() {
    const data = getFilteredData();
    if (data.length === 0) return;

    const topEvents = data
        .sort((a, b) => b.best - a.best)
        .slice(0, 10);

    const container = d3.select("#chart-top-events");
    if (container.empty()) {
        d3.select("#charts-panel").append("div").attr("id", "chart-top-events").attr("class", "events-list");
    } else {
        container.html('');
    }

    let title = d3.select("#top-events-title");
    if (title.empty()) {
        const chartContainer = d3.selectAll(".chart-container").filter(function () {
            return this.querySelector("#chart-top-events");
        });

        if (!chartContainer.empty()) {
            chartContainer.insert("h4", "#chart-top-events")
                .attr("id", "top-events-title")
                .text("Top Conflicts");
        } else {
            d3.select("#charts-panel").append("h4")
                .attr("id", "top-events-title")
                .text("Top Conflicts");
        }
    } else {
        title.text("Top Conflicts");
    }

    topEvents.forEach((event, i) => {
        const item = container.append("div")
            .attr("class", "event-item")
            .style("border-left-color", REGION_COLORS[event.region])
            .style("animation", `fadeIn 0.3s ease-out ${i * 0.05}s both`)
            .on("click", () => {
                selectEvent(event);
            });

        item.append("div")
            .attr("class", "event-item-title")
            .text(`${i + 1}. ${event.dyad_name || 'Unknown Event'}`);

        item.append("div")
            .attr("class", "event-item-meta")
            .html(`
                ${event.date_start || event.year} • 
                <strong style="color: #ef4444;">${d3.format(",d")(event.best)}</strong> casualties • 
                <span style="color: ${TYPE_COLORS[event.type_of_violence_name]};">${event.type_of_violence_name}</span>
            `);
    });
}

function renderEventDetailsView(d) {
    const container = d3.select("#charts-panel");
    container.style("display", "flex");
    d3.select("#charts-title").text("Event Details");
    d3.select("#charts-subtitle").text(d.dyad_name);

    // Hide all chart containers first
    container.selectAll(".chart-container").style("display", "none");

    // 1. Text Details - Reuse existing container with optimized updates
    let detailsContainer = container.select("#event-text-details");
    if (detailsContainer.empty()) {
        detailsContainer = container.append("div")
            .attr("id", "event-text-details")
            .attr("class", "chart-container");
    }

    detailsContainer
        .style("display", "block")
        .html(`
        <div class="country-info-item">
            <span class="country-info-label">Date:</span>
            <span class="country-info-value">${d.date_start || d.year}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Side A:</span>
            <span class="country-info-value">${d.side_a}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Side B:</span>
            <span class="country-info-value">${d.side_b}</span>
        </div>
        <div class="country-info-item">
            <span class="country-info-label">Casualties:</span>
            <span class="country-info-value" style="color: #ef4444;">${d3.format(",d")(d.best)}</span>
        </div>
        <div class="country-info-item" style="border-bottom: none; display: block;">
             <span class="country-info-label">Description:</span><br>
             <p style="color: #cbd5e1; font-size: 0.85rem; margin-top: 5px; line-height: 1.4;">
                ${d.where_description || 'No detailed description available.'}
             </p>
        </div>
    `);

    // 2. Victim Chart - Only render if casualties > 100
    if (d.best <= 100) {
        // Hide the victim chart container when not needed
        const victimChartContainer = container.selectAll(".chart-container").filter(function () {
            return d3.select(this).select("#chart-victims").size() > 0;
        });
        victimChartContainer.style("display", "none");
        return; // Early exit
    }

    // Pre-filter and sort victim data
    const victims = [
        { category: 'Country', deaths: d.deaths_a || 0 },
        { category: 'Opponent', deaths: d.deaths_b || 0 },
        { category: 'Civilians', deaths: d.deaths_civilians || 0 },
        { category: 'Unknown', deaths: d.deaths_unknown || 0 }
    ].filter(v => v.deaths > 0).sort((a, b) => b.deaths - a.deaths);

    // Find the chart-victims container in the HTML
    const victimChartContainer = container.selectAll(".chart-container").filter(function () {
        return d3.select(this).select("#chart-victims").size() > 0;
    });

    if (victimChartContainer.empty()) {
        console.error("chart-victims container not found");
        return;
    }

    victimChartContainer.style("display", "block");

    // Use requestAnimationFrame to batch chart rendering
    requestAnimationFrame(() => {
        const svg = d3.select("#chart-victims");
        const width = victimChartContainer.node().getBoundingClientRect().width || 300;
        const height = 260; // Increased height for labels
        const radius = Math.min(width, height - 60) / 2 - 30; // Leave space for labels and legend

        // Cache SVG dimensions and group if not already cached or size changed
        if (!cachedVictimChartSVG || cachedVictimChartSVG.attr("width") !== width.toString()) {
            svg.attr("width", width).attr("height", height);
            cachedVictimChartSVG = svg;
        }

        // Clear existing content more efficiently
        svg.selectAll("g").remove();

        const g = svg.append("g").attr("transform", `translate(${width / 2},${(height - 40) / 2})`);
        cachedVictimChartG = g;

        // Pre-defined color scale (avoid recreation)
        const color = d3.scaleOrdinal()
            .domain(['Country', 'Opponent', 'Civilians', 'Unknown'])
            .range(['#d62728', '#1f77b4', '#2ca02c', '#7f7f7f']);

        const pie = d3.pie().value(d => d.deaths).sort(null);
        const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);
        const labelArc = d3.arc().innerRadius(radius * 0.9).outerRadius(radius * 0.9);

        // Calculate total for percentages
        const total = d3.sum(victims, v => v.deaths);

        // Use D3 update pattern for better performance
        const arcs = g.selectAll(".arc")
            .data(pie(victims), d => d.data.category);

        // Exit
        arcs.exit().remove();

        // Enter + Update
        const arcsEnter = arcs.enter()
            .append("g")
            .attr("class", "arc");

        arcsEnter.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.category))
            .attr("stroke", "#0f172a")
            .style("stroke-width", "2px")
            .style("opacity", 0.8)
            .on("mouseover", function (event, d) {
                d3.select(this).style("opacity", 1).style("stroke", "#fff");
            })
            .on("mouseout", function () {
                d3.select(this).style("opacity", 0.8).style("stroke", "#0f172a");
            });

        // Add persistent labels with percentages
        arcsEnter.append("text")
            .attr("class", "arc-label")
            .attr("transform", d => {
                const pos = labelArc.centroid(d);
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                pos[0] = radius * 1.1 * (midAngle < Math.PI ? 1 : -1);
                return `translate(${pos})`;
            })
            .attr("text-anchor", d => {
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                return midAngle < Math.PI ? "start" : "end";
            })
            .style("fill", "#0f172a")
            .style("font-size", "0.7rem")
            .style("font-weight", "600")
            .text(d => {
                const percentage = ((d.data.deaths / total) * 100).toFixed(1);
                return `${d.data.category}: ${percentage}%`;
            });

        // Add polylines connecting labels to segments
        arcsEnter.append("polyline")
            .attr("class", "arc-line")
            .attr("points", d => {
                const pos = labelArc.centroid(d);
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const labelPos = [radius * 1.05 * (midAngle < Math.PI ? 1 : -1), pos[1]];
                return [arc.centroid(d), labelArc.centroid(d), labelPos];
            })
            .style("fill", "none")
            .style("stroke", "#94a3b8")
            .style("stroke-width", "1px")
            .style("opacity", 0.5);

        // Update existing arcs
        arcs.select("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.category));

        // Add legend at the bottom
        const legend = svg.append("g")
            .attr("class", "victim-legend")
            .attr("transform", `translate(10, ${height - 35})`);

        victims.forEach((v, i) => {
            const legendItem = legend.append("g")
                .attr("transform", `translate(${i * (width / victims.length)}, 0)`);

            legendItem.append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", color(v.category))
                .attr("rx", 2);

            legendItem.append("text")
                .attr("x", 14)
                .attr("y", 9)
                .style("fill", "#64748b")
                .style("font-size", "0.65rem")
                .text(`${v.category} (${d3.format(",d")(v.deaths)})`);
        });
    });
}




// ============================================================================
// COUNTRY INFORMATION API
// ============================================================================

let countryInfoMap = new Map();

async function fetchCountryInfo() {
    try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,population,area,cca3,capital,capitalInfo');
        const data = await response.json();

        data.forEach(country => {
            countryInfoMap.set(country.name.common, {
                population: d3.format(",")(country.population),
                area: d3.format(",")(country.area) + " km²",
                areaNumeric: country.area, // Store numeric area for scaling calculations
                capital: country.capital ? country.capital[0] : null,
                capitalCoords: country.capitalInfo?.latlng ? [country.capitalInfo.latlng[1], country.capitalInfo.latlng[0]] : null // [lon, lat]
            });
        });

    } catch (error) {
        console.error("❌ Error fetching country info:", error);
    }
}

// ============================================================================
// LEGEND
// ============================================================================

function createLegend() {
    const legendContainer = d3.select("#legend");
    legendContainer.html('');

    Object.entries(REGION_COLORS).forEach(([region, color]) => {
        const item = legendContainer.append("div")
            .attr("class", "legend-item active")
            .attr("data-region", region)
            .on("click", () => {
                // Check if we're in graph view or map view
                if (graphViewActive) {
                    // In graph view: toggle region filter and update graph
                    if (viewState.selectedRegion === region) {
                        // ✅ Clicking same region = DESELECT
                        viewState.selectedRegion = null;
                        viewState.mode = 'world';
                        d3.select("#reset-zoom").style("display", "none");
                        // Remove selection from all region items
                        d3.select("#legend").selectAll(".legend-item").classed("selected", false);
                        d3.select("#charts-title").text("Top Factions");
                    } else {
                        // ✅ Select new region with visual highlight
                        viewState.selectedRegion = region;
                        viewState.mode = 'region';
                        d3.select("#reset-zoom").style("display", "block");
                        // Add 'selected' class to clicked region only
                        d3.select("#legend").selectAll(".legend-item")
                            .classed("selected", function () {
                                return this.getAttribute("data-region") === region;
                            });
                        d3.select("#charts-title").text(`Top Factions - ${region}`);
                    }
                    // Update graph view with new filter
                    if (typeof updateGraphView !== 'undefined') {
                        updateGraphView();
                    }
                } else {
                    // In map view: use existing toggle region behavior
                    toggleRegion(region);
                }
            });

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("span").text(region);

        // ✅ Set initial 'selected' class if this region is already selected
        item.classed("selected", viewState.selectedRegion === region);
    });
}

// Create Violence Type Filter (works across all views)
function createViolenceTypeFilter() {
    const filterContainer = d3.select("#violence-type-filter");
    filterContainer.html('');

    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const item = filterContainer.append("div")
            .attr("class", "legend-item active")
            .attr("data-type", type)
            .style("cursor", "pointer")
            .style("transition", "all 0.2s")
            .classed("selected", viewState.selectedViolenceType === type)
            .on("click", () => {
                // Toggle violence type filter
                if (viewState.selectedViolenceType === type) {
                    viewState.selectedViolenceType = null;
                } else {
                    viewState.selectedViolenceType = type;
                }

                // Update visual state with dimming
                filterContainer.selectAll(".legend-item")
                    .classed("selected", function () {
                        return this.getAttribute("data-type") === viewState.selectedViolenceType;
                    })
                    .style("opacity", function () {
                        const itemType = this.getAttribute("data-type");
                        const isSelected = itemType === viewState.selectedViolenceType;
                        const hasSelection = viewState.selectedViolenceType !== null;
                        return isSelected || !hasSelection ? "1" : "0.5";
                    });

                // Refresh current view
                if (viewState.mode === 'world') {
                    drawConflictBubbles();
                    renderTopCountriesList();
                    updateStats();
                } else if (viewState.mode === 'region') {
                    toggleRegion(viewState.selectedRegion);
                } else if (viewState.mode === 'country') {
                    drawIndividualEventBubbles();
                    updateAllCharts();
                    updateLeftPanel();
                }

                // Update graph view if active
                if (typeof updateGraphView !== 'undefined' && graphViewActive) {
                    updateGraphView();
                }
            });

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("span").text(type);

        // ✅ Set initial opacity based on selection state
        const isThisSelected = viewState.selectedViolenceType === type;
        const hasAnySelection = viewState.selectedViolenceType !== null;
        item.style("opacity", isThisSelected || !hasAnySelection ? "1" : "0.5");
    });
}


// Draw regional stacked bars in Overview Statistics
function drawRegionalStackedBars(data) {
    // Remove existing bars
    d3.select("#regional-bars").remove();

    // Calculate regional breakdown
    const regionalData = d3.rollup(
        data,
        v => ({
            events: v.length,
            casualties: d3.sum(v, d => d.best)
        }),
        d => d.region
    );

    const totalEvents = data.length;
    const totalCasualties = d3.sum(data, d => d.best);

    // Create container after Total Casualties
    const container = d3.select(".stats-container")
        .append("div")
        .attr("id", "regional-bars")
        .style("margin-top", "1rem");

    // Events bar
    container.append("div")
        .style("margin-bottom", "0.75rem")
        .html(`
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Events by Region</div>
            <div id="events-bar" style="display: flex; height: 20px; border-radius: 4px; overflow: hidden;"></div>
        `);

    const eventsBar = container.select("#events-bar");
    Object.entries(REGION_COLORS).forEach(([region, color]) => {
        const regionStats = regionalData.get(region);
        if (regionStats && regionStats.events > 0) {
            const percentage = (regionStats.events / totalEvents) * 100;
            eventsBar.append("div")
                .style("width", `${percentage}%`)
                .style("background", color)
                .style("height", "100%")
                .attr("title", `${region}: ${d3.format(",d")(regionStats.events)} events (${d3.format(".1f")(percentage)}%)`);
        }
    });

    // Casualties bar
    container.append("div")
        .html(`
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Casualties by Region</div>
            <div id="casualties-bar" style="display: flex; height: 20px; border-radius: 4px; overflow: hidden;"></div>
        `);

    const casualtiesBar = container.select("#casualties-bar");
    Object.entries(REGION_COLORS).forEach(([region, color]) => {
        const regionStats = regionalData.get(region);
        if (regionStats && regionStats.casualties > 0) {
            const percentage = (regionStats.casualties / totalCasualties) * 100;
            casualtiesBar.append("div")
                .style("width", `${percentage}%`)
                .style("background", color)
                .style("height", "100%")
                .attr("title", `${region}: ${d3.format(",d")(regionStats.casualties)} casualties (${d3.format(".1f")(percentage)}%)`);
        }
    });
}

// Draw violence type stacked chart in Overview Statistics (for regional view)
function drawViolenceTypeStackedChart(data) {
    // Remove existing bars
    d3.select("#regional-bars").remove();

    // Calculate violence type breakdown
    const typeData = d3.rollup(
        data,
        v => ({
            events: v.length,
            casualties: d3.sum(v, d => d.best)
        }),
        d => d.type_of_violence_name
    );

    const totalEvents = data.length;
    const totalCasualties = d3.sum(data, d => d.best);

    // Create container after Total Casualties
    const container = d3.select(".stats-container")
        .append("div")
        .attr("id", "regional-bars")
        .style("margin-top", "1rem");

    // Combined title
    container.append("div")
        .style("font-size", "0.8rem")
        .style("color", "var(--text-primary)")
        .style("font-weight", "600")
        .style("margin-bottom", "0.75rem")
        .text("Breakdown by Violence Type");

    // Events bar with label
    const eventsSection = container.append("div")
        .style("margin-bottom", "0.75rem");

    eventsSection.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("margin-bottom", "0.25rem")
        .html(`
            <span style="font-size: 0.7rem; color: var(--text-muted);">Events</span>
            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">${d3.format(",d")(totalEvents)}</span>
        `);

    const eventsBar = eventsSection.append("div")
        .attr("id", "events-bar")
        .style("display", "flex")
        .style("height", "24px")
        .style("border-radius", "4px")
        .style("overflow", "hidden")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)");

    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const typeStats = typeData.get(type);
        if (typeStats && typeStats.events > 0) {
            const percentage = (typeStats.events / totalEvents) * 100;
            eventsBar.append("div")
                .style("width", `${percentage}%`)
                .style("background", color)
                .style("height", "100%")
                .style("position", "relative")
                .style("cursor", "pointer")
                .attr("title", `${type}: ${d3.format(",d")(typeStats.events)} events (${d3.format(".1f")(percentage)}%)`)
                .on("mouseover", function () {
                    d3.select(this).style("opacity", "0.8");
                })
                .on("mouseout", function () {
                    d3.select(this).style("opacity", "1");
                });
        }
    });

    // Casualties bar with label
    const casualtiesSection = container.append("div")
        .style("margin-bottom", "0.5rem");

    casualtiesSection.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("margin-bottom", "0.25rem")
        .html(`
            <span style="font-size: 0.7rem; color: var(--text-muted);">Casualties</span>
            <span style="font-size: 0.7rem; color: #ef4444; font-weight: 600;">${d3.format(",d")(totalCasualties)}</span>
        `);

    const casualtiesBar = casualtiesSection.append("div")
        .attr("id", "casualties-bar")
        .style("display", "flex")
        .style("height", "24px")
        .style("border-radius", "4px")
        .style("overflow", "hidden")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)");

    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const typeStats = typeData.get(type);
        if (typeStats && typeStats.casualties > 0) {
            const percentage = (typeStats.casualties / totalCasualties) * 100;
            casualtiesBar.append("div")
                .style("width", `${percentage}%`)
                .style("background", color)
                .style("height", "100%")
                .style("position", "relative")
                .style("cursor", "pointer")
                .attr("title", `${type}: ${d3.format(",d")(typeStats.casualties)} casualties (${d3.format(".1f")(percentage)}%)`)
                .on("mouseover", function () {
                    d3.select(this).style("opacity", "0.8");
                })
                .on("mouseout", function () {
                    d3.select(this).style("opacity", "1");
                });
        }
    });

    // Add legend with clickable filters
    const legend = container.append("div")
        .style("display", "flex")
        .style("gap", "8px")
        .style("margin-top", "0.5rem")
        .style("flex-wrap", "wrap")
        .style("padding-top", "0.5rem")
        .style("border-top", "1px solid var(--border-color)");

    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
        const typeStats = typeData.get(type);
        if (typeStats && (typeStats.events > 0 || typeStats.casualties > 0)) {
            const item = legend.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "4px")
                .style("font-size", "0.65rem")
                .style("cursor", "pointer")
                .style("padding", "4px 6px")
                .style("border-radius", "4px")
                .style("background", viewState.selectedViolenceType === type ? "rgba(37, 99, 235, 0.1)" : "transparent")
                .style("border", viewState.selectedViolenceType === type ? "1px solid #2563eb" : "1px solid transparent")
                .style("transition", "all 0.2s")
                .on("click", function () {
                    // Toggle filter
                    if (viewState.selectedViolenceType === type) {
                        viewState.selectedViolenceType = null;
                    } else {
                        viewState.selectedViolenceType = type;
                    }
                    // Refresh the view
                    toggleRegion(viewState.selectedRegion);
                })
                .on("mouseover", function () {
                    if (viewState.selectedViolenceType !== type) {
                        d3.select(this).style("background", "rgba(100, 116, 139, 0.1)");
                    }
                })
                .on("mouseout", function () {
                    if (viewState.selectedViolenceType !== type) {
                        d3.select(this).style("background", "transparent");
                    }
                });

            item.append("div")
                .style("width", "10px")
                .style("height", "10px")
                .style("background", color)
                .style("border-radius", "2px");

            item.append("span")
                .style("color", "var(--text-muted)")
                .text(type);
        }
    });
}

function toggleRegion(region) {
    // Enter region view mode
    viewState.mode = 'region';
    viewState.selectedRegion = region;
    updateStats();

    // Keep sphere and graticule visible
    mapGroup.select(".sphere").style("display", "block").style("opacity", 1);
    mapGroup.select(".graticule").style("display", "block").style("opacity", 0.5);

    // Get country names with conflict data in this region
    const regionCountryNames = processedData
        .filter(c => c.region === region)
        .map(c => c.name);

    // Keep ALL countries visible at FULL opacity (to avoid hiding mislabeled countries)
    mapGroup.selectAll(".country")
        .style("display", "block")
        .transition()
        .duration(500)
        .style("opacity", 1) // All countries at full opacity
        .style("pointer-events", "auto"); // All countries remain clickable

    // Draw bubbles for region countries
    bubblesGroup.selectAll(".conflict-bubble").remove();

    const currentYear = +document.getElementById('year-slider').value;

    // Use dataFilterManager for optimized region filtering
    const filterOptions = { year: currentYear };
    if (viewState.selectedViolenceType) {
        filterOptions.violenceType = viewState.selectedViolenceType;
    }
    const currentYearData = dataFilterManager.getRegionEvents(region, filterOptions);
    const currentCountryData = aggregationManager.aggregateByCountry(currentYearData, countryData);

    let filteredCountries = currentCountryData.filter(d => d.coordinates);

    const maxCasualties = d3.max(filteredCountries, d => d.totalCasualties) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [5 / zoomFactor, 40 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".conflict-bubble")
        .data(filteredCountries, d => d.name)
        .join("circle")
        .attr("class", "conflict-bubble")
        .attr("cx", d => projection(d.coordinates)[0])
        .attr("cy", d => projection(d.coordinates)[1])
        .attr("r", d => radiusScale(d.totalCasualties))
        .style("fill", d => REGION_COLORS[d.region])
        .style("cursor", "pointer")
        .style("opacity", 0.7)
        .on("click", handleBubbleClick);

    // Zoom to region
    zoomToRegion(region);

    // Show reset button
    d3.select("#reset-zoom").style("display", "block");

    // Show Top Countries panel for this region
    d3.select("#charts-panel").style("display", "flex");
    d3.select("#charts-title").text(`Top Countries - ${region}`);
    renderTopCountriesList();

    // Update legend visual feedback
    d3.selectAll(".legend-item")
        .classed("active", function () {
            return this.getAttribute("data-region") === region;
        });
}

function zoomToRegion(region) {
    // Find all countries in this region
    const regionCountries = processedData.filter(c => c.region === region);
    if (regionCountries.length === 0) return;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    regionCountries.forEach(c => {
        if (c.coordinates) {
            const [x, y] = projection(c.coordinates);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    });

    if (minX === Infinity) return;

    // Add padding
    const padding = 50;
    const width = maxX - minX;
    const height = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const scale = Math.min(8, 0.9 / Math.max(width / mapWidth, height / mapHeight));
    const translate = [mapWidth / 2 - scale * cx, mapHeight / 2 - scale * cy];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// ============================================================================
// TIME SLIDER & MODAL LOGIC
// ============================================================================

function createTimeSlider() {
    const slider = document.getElementById('year-slider');
    const currentYearDisplay = document.getElementById('year-current');
    const playBtn = document.getElementById('play-btn');
    let playInterval;

    // OPTIMIZED: Use throttle instead of debounce for responsive slider (50ms)
    const throttledUpdate = throttle((year) => {
        updateMapForYear(year);
    }, 50);

    slider.addEventListener('input', function () {
        currentYearDisplay.textContent = this.value;
        throttledUpdate(this.value);
    });

    playBtn.addEventListener('click', function () {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            this.textContent = "▶ Play";
        } else {
            this.textContent = "⏸ Pause";
            playInterval = setInterval(() => {
                let val = +slider.value;
                if (val >= +slider.max) val = +slider.min;
                else val++;

                slider.value = val;
                currentYearDisplay.textContent = val;
                updateMapForYear(val);

                if (val === +slider.max) {
                    clearInterval(playInterval);
                    playInterval = null;
                    playBtn.textContent = "▶ Play";
                }
            }, 500); // 0.5s per year
        }
    });
}

// OPTIMIZED: Track pending RAF update for cancellation
let pendingGraphMapUpdate = null;

function updateMapForYear(year) {
    // Cancel any pending update to avoid stacking
    if (pendingGraphMapUpdate) {
        cancelAnimationFrame(pendingGraphMapUpdate);
    }

    // Batch all DOM updates in a single RAF call
    pendingGraphMapUpdate = requestAnimationFrame(() => {
        // OPTIMIZED: Interrupt any running transitions before starting new ones
        if (typeof bubblesGroup !== 'undefined' && bubblesGroup) {
            bubblesGroup.selectAll(".conflict-bubble, .event-bubble").interrupt();
        }

        updateStats();

        if (viewState.mode === 'world') {
            drawConflictBubbles();
            renderTopCountriesList();
        } else if (viewState.mode === 'region') {
            toggleRegion(viewState.selectedRegion);
        } else if (viewState.mode === 'country') {
            drawIndividualEventBubbles();
            updateAllCharts();
            updateLeftPanel();
        } else if (viewState.mode === 'faction') {
            // Redraw faction bubbles with updated year filter
            updateFactionViewForYear(year);
        }

        // Update graph view if active
        if (typeof updateGraphView !== 'undefined' && graphViewActive) {
            updateGraphView();
        }

        pendingGraphMapUpdate = null;
    });
}

// Update faction view when time slider changes
function updateFactionViewForYear(year) {
    const factionId = viewState.selectedFactionName;
    if (!factionId) return;

    // Re-filter events for the faction based on current year
    let factionEvents = rawData.filter(e => {
        if (e.year > year) return false;
        const sideA = e.side_a || '';
        const sideB = e.side_b || '';
        return sideA.includes(factionId) || sideB.includes(factionId);
    });

    // Apply violence type filter if active
    if (viewState.selectedViolenceType) {
        factionEvents = factionEvents.filter(e =>
            e.type_of_violence_name === viewState.selectedViolenceType
        );
    }

    // Update stored faction data
    viewState.selectedFactionData = factionEvents;

    // Check view level and update appropriately
    if (viewState.factionViewLevel === 'country' || viewState.selectedCountryInFaction) {
        // Single country view: progressive events with time coloring
        let eventsToShow = factionEvents;
        if (viewState.selectedCountryInFaction) {
            eventsToShow = factionEvents.filter(e => e.country === viewState.selectedCountryInFaction);
        }
        drawFactionBubblesProgressive(eventsToShow, year);
    } else {
        // Multi-country view: update country bubble sizes smoothly
        updateFactionCountryBubbleSizes(factionEvents);
    }

    // Re-apply connected faction filter if active (only applies to event bubbles)
    if (viewState.selectedConnectedFaction && viewState.factionViewLevel === 'country') {
        const filteredEvents = factionEvents.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(viewState.selectedConnectedFaction) ||
                sideB.includes(viewState.selectedConnectedFaction);
        });
        filterEventBubblesOnMap(filteredEvents);
    }

    // Update charts with new data - use displayFactionCharts for consistency with graph view
    const chartsPanel = d3.select("#charts-panel");
    if (!chartsPanel.empty() && chartsPanel.style("display") !== "none") {
        // Create factionData-like object for displayFactionCharts
        const factionData = {
            id: factionId,
            country: factionEvents.length > 0 ? factionEvents[0].country : 'Unknown',
            region: factionEvents.length > 0 ? factionEvents[0].region : 'Unknown'
        };
        displayFactionCharts(factionData, factionEvents);
    }

    // Update left panel - rebuild with new time-filtered data
    const countries = [...new Set(factionEvents.map(e => e.country))].sort();
    updateFactionPanel(factionId, factionEvents, countries, null);
}

// Draw faction events progressively with time-based coloring (old=gray, new=color)
function drawFactionBubblesProgressive(events, currentYear) {
    const eventsWithCoords = events.filter(e => e.latitude && e.longitude);

    const maxCasualties = d3.max(eventsWithCoords, e => e.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([3 / zoomFactor, 20 / zoomFactor]);

    // Find max year in current data for "new" determination
    const latestEventYear = d3.max(eventsWithCoords, e => e.year) || currentYear;

    // D3 data join
    const bubbles = bubblesGroup.selectAll(".event-bubble")
        .data(eventsWithCoords, d => `${d.country}-${d.year}-${d.latitude?.toFixed(4)}-${d.longitude?.toFixed(4)}`);

    // Exit: fade out removed events
    bubbles.exit()
        .transition().duration(300)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    // Enter: new events appear with original color
    bubbles.enter()
        .append("circle")
        .attr("class", "event-bubble")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 0)
        .style("fill", d => TYPE_COLORS[d.type_of_violence_name])
        .style("opacity", 0)
        .style("cursor", "pointer")
        .on("click", (event, d) => { event.stopPropagation(); selectEvent(d); })
        .on("mouseover", showEventTooltip)
        .on("mouseout", hideEventTooltip)
        .transition().duration(400)
        .attr("r", d => radiusScale(d.best))
        .style("opacity", 0.8);

    // Update: existing events - gray out older ones
    bubbles
        .transition().duration(300)
        .attr("r", d => radiusScale(d.best))
        .style("fill", d => d.year < latestEventYear ? "#94a3b8" : TYPE_COLORS[d.type_of_violence_name])
        .style("opacity", d => d.year < latestEventYear ? 0.5 : 0.8);
}

// Update faction panel statistics without rebuilding entire panel
function updateFactionPanelStats(factionId, events) {
    const currentYear = +document.getElementById('year-slider').value;
    const currentEvents = events.filter(e => e.year <= currentYear);
    const casualties = d3.sum(currentEvents, e => e.best);

    // Update stats in left panel if they exist
    const statsElements = d3.selectAll(".country-info-value");
    statsElements.each(function () {
        const label = d3.select(this.parentNode).select(".country-info-label").text();
        if (label === "Total Events:") {
            d3.select(this).text(d3.format(",d")(currentEvents.length));
        } else if (label === "Total Casualties:") {
            d3.select(this).text(d3.format(",d")(casualties));
        }
    });
}

function setupModal() {
    const modal = document.getElementById('event-modal');
    const closeBtn = document.querySelector('.close-modal');

    closeBtn.onclick = function () {
        modal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function setupBackButton() {
    const resetBtn = document.getElementById('reset-zoom');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            // Check current view mode to determine appropriate exit behavior
            if (graphViewActive && viewState.mode === 'region') {
                // In graph view with region filter: return to global graph view
                viewState.selectedRegion = null;
                viewState.mode = 'world';
                d3.select("#reset-zoom").style("display", "none");
                d3.selectAll(".legend-item").classed("active", true);
                d3.select("#charts-title").text("Top Factions");
                if (typeof updateGraphView !== 'undefined') {
                    updateGraphView();
                }
            } else if (graphViewActive) {
                // In global graph view: no special action needed, shouldn't have back button visible

            } else {
                // In map view: use existing exit behaviors
                returnToWorldView();
            }
        });
    }
}

// Setup view mode toggle buttons (Map View / Graph View)
function setupViewToggle() {
    const mapViewBtn = document.getElementById('map-view-btn');
    const graphViewBtn = document.getElementById('graph-view-btn');

    if (mapViewBtn) {
        mapViewBtn.addEventListener('click', function () {
            toggleViewMode('map');
        });
    }

    if (graphViewBtn) {
        graphViewBtn.addEventListener('click', function () {
            toggleViewMode('graph');
        });
    }
}

// Toggle between map and graph views
function toggleViewMode(mode) {
    const mapContainer = document.getElementById('world-map');
    const graphContainer = document.getElementById('graph-container');
    const mapViewBtn = document.getElementById('map-view-btn');
    const graphViewBtn = document.getElementById('graph-view-btn');
    const relationshipFilterSection = document.getElementById('relationship-filter-section');

    // CRITICAL: Clear panel contents before switching views
    if (typeof cleanupPanelsForViewSwitch === 'function') {
        cleanupPanelsForViewSwitch();
    }

    if (mode === 'graph') {
        // Switch to graph view
        if (mapContainer) mapContainer.style.display = 'none';
        if (graphContainer) graphContainer.style.display = 'block';
        if (mapViewBtn) mapViewBtn.classList.remove('active');
        if (graphViewBtn) graphViewBtn.classList.add('active');

        // Show relationship filter section for graph view
        if (relationshipFilterSection) {
            relationshipFilterSection.style.display = 'block';
        }

        // Initialize graph view
        if (typeof initGraphView !== 'undefined') {
            initGraphView();
        }
    } else {
        // Switch to map view
        if (graphContainer) graphContainer.style.display = 'none';
        if (mapContainer) mapContainer.style.display = 'block';
        if (graphViewBtn) graphViewBtn.classList.remove('active');
        if (mapViewBtn) mapViewBtn.classList.add('active');

        // Hide relationship filter section in map view
        if (relationshipFilterSection) {
            relationshipFilterSection.style.display = 'none';
        }

        // Stop graph simulation if active
        if (typeof allFactionsSimulation !== 'undefined' && allFactionsSimulation) {
            allFactionsSimulation.stop();
        }

        // Reset graph view state
        if (typeof graphViewActive !== 'undefined') {
            graphViewActive = false;
        }
        if (typeof allFactionsActive !== 'undefined') {
            allFactionsActive = false;
        }

        // Refresh map view (only if functions exist)
        if (typeof updateStats === 'function') updateStats();
        if (typeof drawConflictBubbles === 'function') drawConflictBubbles();
        if (typeof renderTopCountriesList === 'function') renderTopCountriesList();
    }
}


// Cleanup panels when switching between views
function cleanupPanelsForViewSwitch() {
    const leftPanel = d3.select("#left-panel");
    const rightPanel = d3.select("#charts-panel");

    // Remove faction-specific panels from graph view
    leftPanel.select("#faction-info-panel").remove();

    // Remove country-specific panels from map view
    leftPanel.select("#country-info-section").remove();
    leftPanel.select("#stats-overview-section").remove();
    leftPanel.select("#pie-chart-section").remove();

    // Remove regional breakdown bars
    leftPanel.select("#regional-bars").remove();

    // Clear right panel contents
    rightPanel.selectAll("*").remove();

    // Reset left panel visibility
    leftPanel.select(".stats-container").style("display", "block");
    leftPanel.select(".legend-section").style("display", "block");
    leftPanel.select(".violence-filter-section").style("display", "block");

    // Hide right panel by default (will be shown by specific views as needed)
    rightPanel.style("display", "none");
}

function returnToWorldView() {
    // Reset view state
    viewState.mode = 'world';
    viewState.selectedCountryName = null;
    viewState.selectedCountryData = null;
    viewState.selectedConflictType = null;
    viewState.selectedEvent = null;
    viewState.selectedRegion = null;
    viewState.selectedViolenceType = null;

    // Hide reset button
    d3.select("#reset-zoom").style("display", "none");

    // Hide right panel
    d3.select("#charts-panel").style("display", "none");

    // Remove country info section if it exists
    d3.select("#country-info-section").remove();
    d3.select("#stats-overview-section").remove();

    // Restore original stats section
    d3.select(".stats-container").style("display", "block");

    // Reset zoom
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);

    // Restore sphere and graticule
    mapGroup.select(".sphere")
        .style("display", "block")
        .transition()
        .duration(500)
        .style("opacity", 1);

    mapGroup.select(".graticule")
        .style("display", "block")
        .transition()
        .duration(500)
        .style("opacity", 0.1);

    // Restore all countries to full opacity
    mapGroup.selectAll(".country")
        .style("display", "block")
        .style("pointer-events", "auto")
        .transition()
        .duration(500)
        .style("opacity", 1);

    // Clear event bubbles
    bubblesGroup.selectAll(".event-bubble").remove();
    bubblesGroup.selectAll(".capital-marker").remove();

    // Redraw world conflict bubbles
    setTimeout(() => {
        drawConflictBubbles();
        updateStats();
        renderTopCountriesList();
    }, 100);
}

function showEventDetails(d) {
    viewState.mode = 'event';
    viewState.selectedEvent = d;
    updateAllCharts();
}

// ============================================================================
// INITIALIZATION - GRAPH VIEW MODE
// ============================================================================

async function init() {
    // Initialize map for data loading (needed for some utilities)
    initializeMap();
    await fetchCountryInfo();
    await drawWorldMap();
    await loadData();

    // Hide map, show graph container
    const mapContainer = document.getElementById('world-map');
    const graphContainer = document.getElementById('graph-container');

    if (mapContainer) mapContainer.style.display = 'none';
    if (graphContainer) graphContainer.style.display = 'block';

    // Initialize Graph View as default
    graphViewActive = true;
    allFactionsActive = true;
    initAllFactionsGraph();
    setupGraphFilters();

    // Setup panel collapse functionality
    setupPanelCollapse();
}


// ============================================================================
// MODERN PANEL COLLAPSE FUNCTIONALITY - Hover to Reveal
// ============================================================================

function setupPanelCollapse() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('charts-panel');
    const leftToggleBtn = document.getElementById('left-panel-toggle');
    const rightToggleBtn = document.getElementById('right-panel-toggle');
    const leftRevealTrigger = document.getElementById('left-reveal-trigger');
    const rightRevealTrigger = document.getElementById('right-reveal-trigger');
    const contentWrapper = document.querySelector('.content-wrapper');
    const timeSlider = document.querySelector('.time-slider-container');

    let hideButtonTimeout = null;
    const EDGE_DISTANCE = 80; // pixels from edge to trigger button reveal
    const HIDE_DELAY = 1500; // ms to wait before auto-hiding buttons

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

        // Show left button when near left edge
        if (isNearLeftEdge && leftToggleBtn) {
            leftToggleBtn.style.opacity = '1';
            leftToggleBtn.style.pointerEvents = 'auto';
        }

        // Show right button when near right edge
        if (isNearRightEdge && rightToggleBtn) {
            rightToggleBtn.style.opacity = '1';
            rightToggleBtn.style.pointerEvents = 'auto';
        }

        // Auto-hide after delay when mouse moves away
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

    // Helper functions to hide panels
    function hideLeftPanel() {
        if (!leftPanel.classList.contains('collapsed')) {
            leftPanel.classList.add('collapsed');
            if (leftToggleBtn) {
                leftToggleBtn.classList.add('collapsed');
                leftToggleBtn.innerHTML = '▶';
            }
            updateLayoutAndCenter();
        }
    }

    function hideRightPanel() {
        if (!rightPanel.classList.contains('collapsed')) {
            rightPanel.classList.add('collapsed');
            if (rightToggleBtn) {
                rightToggleBtn.classList.add('collapsed');
                rightToggleBtn.innerHTML = '◀';
            }
            updateLayoutAndCenter();
        }
    }

    // Update grid layout, center content, and adjust time slider
    function updateLayoutAndCenter() {
        const leftCollapsed = leftPanel.classList.contains('collapsed');
        const rightCollapsed = rightPanel.classList.contains('collapsed');

        // Remove all collapse classes
        contentWrapper.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');

        // Add appropriate class
        if (leftCollapsed && rightCollapsed) {
            contentWrapper.classList.add('both-collapsed');
        } else if (leftCollapsed) {
            contentWrapper.classList.add('left-collapsed');
        } else if (rightCollapsed) {
            contentWrapper.classList.add('right-collapsed');
        }

        // Adjust time slider width based on panel states
        // Make it wider when panels are collapsed
        if (timeSlider) {
            if (leftCollapsed && rightCollapsed) {
                timeSlider.style.width = '80%';
            } else if (leftCollapsed || rightCollapsed) {
                timeSlider.style.width = '70%';
            } else {
                timeSlider.style.width = '60%';
            }
        }

        // Wait for CSS transition, then recalculate and center visualizations
        setTimeout(() => {
            updateVisualizationDimensions();
        }, 450); // Slightly longer than CSS transition (400ms)
    }

    function updateVisualizationDimensions() {
        // Update graph dimensions if active
        if (typeof allFactionsSimulation !== 'undefined' && allFactionsSimulation) {
            const graphContainer = document.getElementById("graph-container");
            const width = graphContainer.clientWidth;
            const height = graphContainer.clientHeight;

            const graphSvg = d3.select("#graph-svg");
            graphSvg.attr("width", width).attr("height", height);

            // Update horizontal layout forces
            const nodes = allFactionsSimulation.nodes();
            if (nodes.length > 0) {
                const regionKeys = Object.keys(REGION_COLORS);
                const numRegions = regionKeys.length;
                const padding = 100;
                const usableWidth = width - padding * 2;

                // Update X force to keep nodes in their region zones
                allFactionsSimulation.force("x", d3.forceX().strength(0.1).x(d => {
                    const regionIndex = regionKeys.indexOf(d.region);
                    const regionWidth = usableWidth / numRegions;
                    return padding + regionIndex * regionWidth + regionWidth / 2;
                }));

                // Update Y force to center vertically
                allFactionsSimulation.force("y", d3.forceY().strength(0.05).y(height / 2));

                // Remove old circular forces if they exist
                allFactionsSimulation.force("radial", null);
                allFactionsSimulation.force("center", null);
            }

            // Gentle restart
            allFactionsSimulation.alpha(0.3).restart();
        }

        // Update map dimensions and projection
        if (typeof svg !== 'undefined' && svg) {
            const mapSection = document.querySelector('.map-section');
            if (mapSection) {
                const mapWidth = mapSection.clientWidth;
                const mapHeight = mapSection.clientHeight;

                svg.attr('width', mapWidth).attr('height', mapHeight);

                // Update projection if needed
                if (typeof projection !== 'undefined' && projection) {
                    projection
                        .scale(mapWidth / 6.5)
                        .translate([mapWidth / 2, mapHeight / 2]);

                    // Redraw map elements with new projection
                    if (viewState.mode === 'world') {
                        mapGroup.selectAll('.country').attr('d', path);
                        mapGroup.selectAll('.sphere').attr('d', path);
                        mapGroup.selectAll('.graticule').attr('d', path);
                    }
                }
            }
        }
    }
}


init();
// ============================================================================
// ALL-FACTIONS GRAPH VIEW - Complete Implementation
// Shows all factions from all countries as nodes, colored by region
// ============================================================================

let allFactionsSimulation = null;
let allFactionsActive = false;
let graphViewActive = false; // Moved from bottom of file

// Graph filter state
let graphFilterState = {
    relationshipType: 'all', // 'all', 'allies', 'opponents'
    focusedFaction: null, // Currently focused faction ID
    lastClickedFaction: null, // For double-click detection
    lastClickTime: 0 // Timestamp of last click
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Split side_a / side_b strings into arrays of entity names
function splitEntities(str) {
    if (!str) return [];
    return str
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
}

// ============================================================================
// BUILD ALL-FACTIONS DATA
// ============================================================================

function buildAllFactionsData() {
    const currentYear = +document.getElementById('year-slider').value;

    // Get filtered countries - use cached data when possible
    let data = processedData.map(c => {
        const events = c.events.filter(e => e.year <= currentYear);
        return { ...c, events };
    }).filter(c => c.events.length > 0);

    // Apply region filter
    if (viewState.selectedRegion) {
        data = data.filter(c => c.region === viewState.selectedRegion);
    }

    // Apply violence type filter
    if (viewState.selectedViolenceType) {
        data = data.map(c => {
            const filtered = c.events.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
            return { ...c, events: filtered };
        }).filter(c => c.events.length > 0);
    }

    // OPTIMIZED: Use Maps for O(1) lookups
    const allFactions = new Map();
    const factionRels = new Map();

    // Pre-calculate civilian check regex for performance
    const civilianPattern = /civilian/i;

    for (const country of data) {
        for (const event of country.events) {
            const fA = splitEntities(event.side_a || '');
            const fB = splitEntities(event.side_b || '');

            // Filter out civilians once
            const fAFiltered = fA.filter(f => !civilianPattern.test(f));
            const fBFiltered = fB.filter(f => !civilianPattern.test(f));

            // Process factions
            for (const f of fAFiltered) {
                if (!allFactions.has(f)) {
                    allFactions.set(f, {
                        id: f,
                        country: country.name,
                        region: country.region,
                        participation: 0,
                        casualties: 0
                    });
                }
                const fd = allFactions.get(f);
                fd.participation++;
                fd.casualties += event.best || 0;
            }

            for (const f of fBFiltered) {
                if (!allFactions.has(f)) {
                    allFactions.set(f, {
                        id: f,
                        country: country.name,
                        region: country.region,
                        participation: 0,
                        casualties: 0
                    });
                }
                const fd = allFactions.get(f);
                fd.participation++;
                fd.casualties += event.best || 0;
            }

            // Build allied relationships (same side) - ALL factions
            for (let i = 0; i < fAFiltered.length; i++) {
                for (let j = i + 1; j < fAFiltered.length; j++) {
                    const key = fAFiltered[i] < fAFiltered[j] ? `${fAFiltered[i]}|${fAFiltered[j]}` : `${fAFiltered[j]}|${fAFiltered[i]}`;
                    if (!factionRels.has(key)) factionRels.set(key, { allied: 0, opposed: 0, cas: 0 });
                    const rel = factionRels.get(key);
                    rel.allied++;
                    rel.cas += event.best || 0;
                }
            }

            for (let i = 0; i < fBFiltered.length; i++) {
                for (let j = i + 1; j < fBFiltered.length; j++) {
                    const key = fBFiltered[i] < fBFiltered[j] ? `${fBFiltered[i]}|${fBFiltered[j]}` : `${fBFiltered[j]}|${fBFiltered[i]}`;
                    if (!factionRels.has(key)) factionRels.set(key, { allied: 0, opposed: 0, cas: 0 });
                    const rel = factionRels.get(key);
                    rel.allied++;
                    rel.cas += event.best || 0;
                }
            }

            // Opposed relationships (opposite sides) - ALL factions
            for (const f1 of fAFiltered) {
                for (const f2 of fBFiltered) {
                    const key = f1 < f2 ? `${f1}|${f2}` : `${f2}|${f1}`;
                    if (!factionRels.has(key)) factionRels.set(key, { allied: 0, opposed: 0, cas: 0 });
                    const rel = factionRels.get(key);
                    rel.opposed++;
                    rel.cas += event.best || 0;
                }
            }
        }
    }

    // Original threshold: minimum 5 events
    const nodes = Array.from(allFactions.values()).filter(n => n.participation >= 5);
    const nodeIds = new Set(nodes.map(n => n.id));

    // Add radius - original sizing
    nodes.forEach(n => {
        n.radius = Math.max(8, Math.min(35, Math.sqrt(n.casualties) / 3));
    });

    // Create links - ALL relationships
    const links = [];
    for (const [key, rel] of factionRels.entries()) {
        if (rel.allied === 0 && rel.opposed === 0) continue;

        const [f1, f2] = key.split('|');
        if (!nodeIds.has(f1) || !nodeIds.has(f2)) continue;

        links.push({
            source: f1,
            target: f2,
            type: rel.allied > rel.opposed ? 'ally' : 'enemy',
            allied: rel.allied,
            opposed: rel.opposed,
            casualties: rel.cas,
            value: Math.sqrt(rel.cas) / 5
        });
    }

    return { nodes, links };
}

// ============================================================================
// INIT ALL-FACTIONS GRAPH
// ============================================================================

function initAllFactionsGraph() {
    const graphSvg = d3.select("#graph-svg");
    const width = document.getElementById("graph-container").clientWidth;
    const height = document.getElementById("graph-container").clientHeight;

    graphSvg.attr("width", width).attr("height", height);
    graphSvg.selectAll("*").remove();

    // Clear map-view specific elements from left panel (e.g., regional breakdown bars)
    d3.select("#regional-bars").remove();

    // Build data
    const { nodes, links } = buildAllFactionsData();

    // Create zoomable group
    const zoomGroup = graphSvg.append("g").attr("class", "zoom-group");

    // HORIZONTAL LAYOUT - nodes spread from left to right, grouped by region
    const regionKeys = Object.keys(REGION_COLORS);
    const numRegions = regionKeys.length;
    const padding = 80;
    const usableWidth = width - padding * 2;

    // PRE-POSITION NODES - initial positions by region
    nodes.forEach((node, i) => {
        const regionIndex = regionKeys.indexOf(node.region);
        const nodesInRegion = nodes.filter(n => n.region === node.region);
        const indexInRegion = nodesInRegion.indexOf(node);

        const regionWidth = usableWidth / numRegions;
        const regionStartX = padding + regionIndex * regionWidth;

        // Initial position with some spread
        node.x = regionStartX + Math.random() * regionWidth;
        node.y = padding + Math.random() * (height - padding * 2);
    });

    // FORCE SIMULATION - nodes can move and settle (IMPROVED SPACING)
    allFactionsSimulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(0.2))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("collision", d3.forceCollide().radius(d => d.radius + 25))
        .force("x", d3.forceX().strength(0.1).x(d => {
            const regionIndex = regionKeys.indexOf(d.region);
            const regionWidth = usableWidth / numRegions;
            return padding + regionIndex * regionWidth + regionWidth / 2;
        }))
        .force("y", d3.forceY().strength(0.05).y(height / 2))
        .alpha(0.8)
        .alphaDecay(0.02);

    // Draw links
    const linkGroup = zoomGroup.append("g").attr("class", "links-group");
    const edgeDensity = Math.min(1, links.length / 100);
    const baseOpacity = Math.max(0.3, 0.7 - edgeDensity * 0.4);

    const link = linkGroup.selectAll("path")
        .data(links)
        .join("path")
        .attr("class", d => d.type === 'ally' ? 'graph-link-ally' : 'graph-link-enemy')
        .attr("stroke", d => d.type === 'ally' ? '#22c55e' : '#ef4444')
        .attr("stroke-width", d => Math.max(1.5, Math.sqrt(d.value) * 1.5))
        .attr("stroke-opacity", baseOpacity)
        .attr("fill", "none");

    link.append("title")
        .text(d => `${d.source.id || d.source} ↔ ${d.target.id || d.target}\n${d.allied} allied • ${d.opposed} opposed\n${d3.format(",d")(d.casualties)} casualties`);

    // Draw nodes
    const nodeGroup = zoomGroup.append("g").attr("class", "nodes-group");
    const node = nodeGroup.selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "graph-node")
        .attr("r", d => d.radius)
        .attr("fill", d => REGION_COLORS[d.region] || "#64748b")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) allFactionsSimulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) allFactionsSimulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }))
        .on("click", (event, d) => {
            event.stopPropagation();
            handleFactionClick(d, nodes, link, node, labelGroup);
        })
        .on("dblclick", (event, d) => {
            event.stopPropagation();
            navigateToFactionDetailView(d);
        });

    node.append("title")
        .text(d => `${d.id}\nCountry: ${d.country}\n${d.participation} events\n${d3.format(",d")(d.casualties)} casualties`);

    // Labels
    const labelGroup = zoomGroup.append("g").attr("class", "labels-group");
    labelGroup.selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", "graph-node-label")
        .attr("dy", -10)
        .style("font-size", "11px")
        .text(d => d.id);

    // Country filter dropdown
    const filterBox = graphSvg.append("g")
        .attr("class", "country-filter")
        .attr("transform", "translate(20, 20)");

    filterBox.append("rect")
        .attr("width", 220)
        .attr("height", 70)
        .attr("fill", "rgba(255, 255, 255, 0.95)")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1)
        .attr("rx", 6);

    filterBox.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .attr("font-weight", "600")
        .attr("font-size", "14px")
        .text("Filter by Country:");

    const countries = ["All Countries", ...new Set(nodes.map(n => n.country))].sort((a, b) => {
        if (a === "All Countries") return -1;
        if (b === "All Countries") return 1;
        return a.localeCompare(b);
    });

    const dropdown = filterBox.append("foreignObject")
        .attr("x", 10)
        .attr("y", 30)
        .attr("width", 200)
        .attr("height", 30);

    const select = dropdown.append("xhtml:select")
        .style("width", "100%")
        .style("padding", "5px")
        .style("font-size", "12px")
        .style("border", "1px solid #cbd5e1")
        .style("border-radius", "4px")
        .style("cursor", "pointer")
        .on("change", function () {
            const selected = this.value;
            if (selected === "All Countries") {
                nodeGroup.selectAll("circle").style("opacity", 1).style("pointer-events", "auto");
                labelGroup.selectAll("text").style("opacity", 1);
                linkGroup.selectAll("path").style("opacity", baseOpacity);
            } else {
                nodeGroup.selectAll("circle")
                    .style("opacity", d => d.country === selected ? 1 : 0.15)
                    .style("pointer-events", d => d.country === selected ? "auto" : "none");
                labelGroup.selectAll("text").style("opacity", d => d.country === selected ? 1 : 0);
                linkGroup.selectAll("path").style("opacity", d => {
                    const sCountry = typeof d.source === 'object' ? d.source.country : nodes.find(n => n.id === d.source)?.country;
                    const tCountry = typeof d.target === 'object' ? d.target.country : nodes.find(n => n.id === d.target)?.country;
                    return (sCountry === selected || tCountry === selected) ? baseOpacity : 0.05;
                });
            }
        });

    countries.forEach(c => {
        select.append("xhtml:option").attr("value", c).text(c);
    });

    // Legend
    const legend = graphSvg.append("g")
        .attr("class", "graph-legend")
        .attr("transform", `translate(20, ${height - 120})`);

    legend.append("rect")
        .attr("width", 200)
        .attr("height", 110)
        .attr("fill", "rgba(255, 255, 255, 0.95)")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1)
        .attr("rx", 6);

    legend.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .attr("font-weight", "600")
        .attr("font-size", "14px")
        .text("Graph Legend");

    legend.append("line")
        .attr("x1", 15).attr("y1", 40).attr("x2", 45).attr("y2", 40)
        .attr("stroke", "#22c55e").attr("stroke-width", 3);
    legend.append("text")
        .attr("x", 55).attr("y", 45).attr("font-size", "12px")
        .text("Allied (same side)");

    legend.append("line")
        .attr("x1", 15).attr("y1", 60).attr("x2", 45).attr("y2", 60)
        .attr("stroke", "#ef4444").attr("stroke-width", 3);
    legend.append("text")
        .attr("x", 55).attr("y", 65).attr("font-size", "12px")
        .text("Opposed (opposite)");

    legend.append("circle")
        .attr("cx", 25).attr("cy", 85).attr("r", 8).attr("fill", "#64748b");
    legend.append("text")
        .attr("x", 40).attr("y", 90).attr("font-size", "12px")
        .text("Size = casualties");

    // Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => zoomGroup.attr("transform", event.transform));
    graphSvg.call(zoom);

    // Click on empty space to clear focus and restore view
    graphSvg.on("click", function (event) {
        // Only trigger if clicking on SVG background (not nodes or other elements)
        if (event.target === this || event.target.classList.contains('zoom-group')) {
            clearFocusMode();
            // Restore original left panel content
            restoreLeftPanelContent(nodes);
        }
    });

    // SIMULATION TICK - update positions dynamically
    allFactionsSimulation.on("tick", () => {
        linkGroup.selectAll("path")
            .attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);

        nodeGroup.selectAll("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labelGroup.selectAll("text")
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    // Update faction rankings
    updateFactionRankings(nodes);
}

// ============================================================================
// UPDATE FACTION RANKINGS
// ============================================================================

function updateFactionRankings(factions) {
    const panel = d3.select("#charts-panel");
    panel.style("display", "flex");
    panel.selectAll("*").remove();

    // Update left panel statistics to reflect filtered factions
    updateGraphStatistics(factions);

    panel.append("h3")
        .style("margin", "0 0 15px 0")
        .style("font-size", "18px")
        .text("Top Factions by Casualties");

    const topFactions = factions
        .sort((a, b) => b.casualties - a.casualties)
        .slice(0, 20);

    const list = panel.append("div")
        .attr("class", "events-list")
        .style("overflow-y", "auto")
        .style("flex", "1");

    topFactions.forEach((faction, index) => {
        const item = list.append("div")
            .attr("class", "event-item")
            .style("border-left-color", REGION_COLORS[faction.region] || "#64748b")
            .style("cursor", "pointer");

        // Track clicks for double-click detection
        let clickCount = 0;
        let clickTimer = null;

        item.on("click", () => {
            clickCount++;

            if (clickCount === 1) {
                // Single click: Focus on this faction in graph
                clickTimer = setTimeout(() => {
                    // Find the faction node in the graph and trigger focus
                    const graphSvg = d3.select("#graph-svg");
                    const allNodes = graphSvg.selectAll(".graph-node").data();
                    const selectedNode = allNodes.find(n => n.id === faction.id);

                    if (selectedNode) {
                        // Trigger focus mode (hide unrelated nodes)
                        focusOnFaction(selectedNode);
                    }
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                // Double click: Navigate to faction detail view
                clearTimeout(clickTimer);
                allFactionsActive = false;
                graphViewActive = false;
                toggleViewMode('map');
                enterFactionView(faction.id, faction);
                clickCount = 0;
            }
        });

        // Title with ranking number inline
        item.append("div")
            .attr("class", "event-item-title")
            .style("display", "flex")
            .style("align-items", "baseline")
            .style("gap", "0.5rem")
            .html(`
                <span style="font-weight: bold; color: #6b7280; font-size: 0.85rem;">${index + 1}.</span>
                <span style="flex: 1;">${faction.id.length > 45 ? faction.id.substring(0, 42) + "..." : faction.id}</span>
            `);

        // Meta information
        item.append("div")
            .attr("class", "event-item-meta")
            .html(`
                ${faction.country} • 
                <strong style="color: #ef4444;">${d3.format(",d")(faction.casualties)}</strong> casualties • 
                ${faction.participation} events
            `);
    });
}

// Update statistics panel with faction data
function updateGraphStatistics(factions) {
    const totalEvents = d3.sum(factions, f => f.participation);
    const totalCasualties = d3.sum(factions, f => f.casualties);

    d3.select("#total-events").text(d3.format(",d")(totalEvents));
    d3.select("#total-casualties").text(d3.format(",d")(totalCasualties));
}

// Calculate time-filtered casualties between two factions
// This recalculates casualties based on currentYear instead of using cached graph link data
function calculateConnectionCasualties(factionId1, factionId2, currentYear) {
    // Find events where both factions are involved (on opposite sides)
    const connectionEvents = rawData.filter(e => {
        if (e.year > currentYear) return false;
        const sideA = e.side_a || '';
        const sideB = e.side_b || '';

        // Check if both factions are involved in the event
        const hasF1 = sideA.includes(factionId1) || sideB.includes(factionId1);
        const hasF2 = sideA.includes(factionId2) || sideB.includes(factionId2);

        return hasF1 && hasF2;
    });

    return d3.sum(connectionEvents, e => e.best);
}

// Display faction details in left panel when a faction is selected
function displayFactionInfo(factionData, allNodes, links) {
    const leftPanel = d3.select("#left-panel");

    // Hide normal content sections
    leftPanel.select(".stats-container").style("display", "none");
    leftPanel.select(".legend-section").style("display", "none");
    leftPanel.select(".violence-filter-section").style("display", "none");
    leftPanel.select("#relationship-filter-section").style("display", "none");

    // Remove any existing faction info
    leftPanel.select("#faction-info-panel").remove();

    // Find connected factions - use time-filtered data from allNodes
    // allNodes is already time-filtered when passed from updateFocusedFactionGraph
    const currentYear = +document.getElementById('year-slider').value;
    const connectedFactions = [];
    const graphSvg = d3.select("#graph-svg");
    graphSvg.selectAll("path").each(function (d) {
        const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
        const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;

        if (sourceId === factionData.id) {
            const targetNode = allNodes.find(n => n.id === targetId);
            if (targetNode) {
                // Recalculate casualties from rawData with current year filter
                const timeFilteredCasualties = calculateConnectionCasualties(
                    factionData.id, targetId, currentYear
                );
                connectedFactions.push({
                    ...targetNode,
                    relationshipType: d.type,
                    casualties: timeFilteredCasualties // Use time-filtered casualties
                });
            }
        } else if (targetId === factionData.id) {
            const sourceNode = allNodes.find(n => n.id === sourceId);
            if (sourceNode) {
                // Recalculate casualties from rawData with current year filter
                const timeFilteredCasualties = calculateConnectionCasualties(
                    factionData.id, sourceId, currentYear
                );
                connectedFactions.push({
                    ...sourceNode,
                    relationshipType: d.type,
                    casualties: timeFilteredCasualties // Use time-filtered casualties
                });
            }
        }
    });

    // Store connected factions globally for chart access
    window.currentConnectedFactions = connectedFactions;

    // Create faction info panel
    const factionPanel = leftPanel.insert("div", ":first-child")
        .attr("id", "faction-info-panel")
        .style("padding", "1.5rem")
        .style("background", "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)")
        .style("border-radius", "8px")
        .style("margin-bottom", "1rem")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    // Title - show country name if filtering by country
    const countryFilter = viewState.selectedCountryInFaction;
    const panelTitle = countryFilter
        ? `Faction Details in ${countryFilter}`
        : "Faction Details";

    factionPanel.append("h3")
        .style("margin", "0 0 1rem 0")
        .style("font-size", "1.2rem")
        .style("color", "#1e293b")
        .style("border-bottom", "2px solid #cbd5e1")
        .style("padding-bottom", "0.5rem")
        .text(panelTitle);

    // Faction name
    factionPanel.append("div")
        .style("margin-bottom", "1rem")
        .style("padding", "0.75rem")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("border-left", `4px solid ${REGION_COLORS[factionData.region] || "#64748b"}`)
        .html(`
            <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${factionData.id}</div>
            <div style="font-size: 0.85rem; color: #64748b;">${factionData.country}</div>
        `);

    // Get faction event data for stats and enhanced details
    // currentYear is already declared above
    let factionEvents = rawData.filter(e => {
        if (e.year > currentYear) return false;
        const sideA = e.side_a || '';
        const sideB = e.side_b || '';
        return sideA.includes(factionData.id) || sideB.includes(factionData.id);
    });

    // Apply country filter if a specific country is selected in faction view
    if (countryFilter) {
        factionEvents = factionEvents.filter(e => e.country === countryFilter);
    }

    // Calculate stats (use filtered data when country is selected)
    const displayEvents = factionEvents.length;
    const displayCasualties = d3.sum(factionEvents, e => e.best);

    // Stats grid
    const statsGrid = factionPanel.append("div")
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
        .style("color", REGION_COLORS[factionData.region] || "#64748b")
        .text(factionData.region);

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
        .text(d3.format(",d")(displayEvents));

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
        .text(d3.format(",d")(displayCasualties));

    // Connections stat
    const connectionsStat = statsGrid.append("div")
        .style("background", "white")
        .style("padding", "0.75rem")
        .style("border-radius", "6px")
        .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)");
    connectionsStat.append("div")
        .style("font-size", "0.75rem")
        .style("color", "#94a3b8")
        .style("margin-bottom", "0.25rem")
        .text("Connections");
    connectionsStat.append("div")
        .style("font-weight", "700")
        .style("color", "#8b5cf6")
        .text(connectedFactions.length);


    // Activity Period
    if (factionEvents.length > 0) {
        const years = factionEvents.map(e => e.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const periodStat = statsGrid.append("div")
            .style("background", "white")
            .style("padding", "0.75rem")
            .style("border-radius", "6px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.05)")
            .style("grid-column", "1 / -1"); // Span both columns

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

    // Countries Involved - only show when NO country is selected
    const countries = [...new Set(factionEvents.map(e => e.country))].sort();

    // Only show countries list when no specific country is selected (not filtered)
    if (!countryFilter && countries.length >= 1) {
        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text(`Countries Involved (${countries.length})`);

        const countriesContainer = factionPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem")
            .style("max-height", "120px")
            .style("overflow-y", "auto");

        const countryStats = countries.map(country => ({
            name: country,
            events: factionEvents.filter(e => e.country === country).length,
            casualties: d3.sum(factionEvents.filter(e => e.country === country), e => e.best)
        })).sort((a, b) => b.casualties - a.casualties);

        countryStats.forEach(country => {
            countriesContainer.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("padding", "0.25rem 0")
                .style("font-size", "0.75rem")
                .style("border-bottom", "1px solid #f1f5f9")
                .html(`
                    <span style="color: #475569;">${country.name}</span>
                    <span style="color: #ef4444; font-weight: 600;">${d3.format(",d")(country.casualties)}</span>
                `);
        });
    }

    // Yearly Activity Heatmap
    if (factionEvents.length > 0) {
        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Activity by Year");

        const heatmapContainer = factionPanel.append("div")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.75rem")
            .style("margin-bottom", "1rem");

        const yearData = d3.rollup(factionEvents, v => d3.sum(v, e => e.best), d => d.year);
        const years = Array.from(yearData.keys()).sort((a, b) => a - b);
        const maxCas = d3.max(Array.from(yearData.values()));

        const heatmapSvg = heatmapContainer.append("svg")
            .attr("width", "100%")
            .attr("height", 50);

        const cellWidth = Math.max(8, Math.min(15, 280 / years.length));

        years.forEach((year, i) => {
            const intensity = yearData.get(year) / maxCas;
            heatmapSvg.append("rect")
                .attr("x", i * (cellWidth + 2))
                .attr("y", 0)
                .attr("width", cellWidth)
                .attr("height", 30)
                .attr("fill", d3.interpolateReds(intensity))
                .attr("rx", 2)
                .append("title").text(`${year}: ${d3.format(",d")(yearData.get(year))} casualties`);
        });

        // Year labels (every 5 years)
        years.filter((y, i) => i % Math.ceil(years.length / 6) === 0).forEach((year, i) => {
            const idx = years.indexOf(year);
            heatmapSvg.append("text")
                .attr("x", idx * (cellWidth + 2) + cellWidth / 2)
                .attr("y", 45)
                .attr("text-anchor", "middle")
                .style("font-size", "8px")
                .style("fill", "#64748b")
                .text(year);
        });
    }

    // Violence Type Breakdown (Mini Bars)
    if (factionEvents.length > 0) {
        const violenceTypes = d3.rollup(
            factionEvents,
            v => ({ count: v.length, casualties: d3.sum(v, e => e.best) }),
            d => d.type_of_violence_name
        );

        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Violence Type Distribution");

        const violenceContainer = factionPanel.append("div")
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
    }

    // Connected factions list (interactive filter)
    if (connectedFactions.length > 0) {
        factionPanel.append("h4")
            .style("margin", "1rem 0 0.5rem 0")
            .style("font-size", "0.9rem")
            .style("color", "#475569")
            .text("Connected Factions (Click to Filter)");

        const connectionsList = factionPanel.append("div")
            .attr("id", "connected-factions-list")
            .style("max-height", "400px")
            .style("overflow-y", "auto")
            .style("background", "white")
            .style("border-radius", "6px")
            .style("padding", "0.5rem");

        // Store connected factions for chart updates
        window.currentConnectedFactions = connectedFactions;
        window.currentFactionData = factionData;
        window.currentFactionEvents = factionEvents;

        connectedFactions
            .sort((a, b) => b.casualties - a.casualties)
            .forEach(conn => {
                const isSelected = viewState.selectedConnectedFaction === conn.id;

                const connItem = connectionsList.append("div")
                    .attr("class", "connected-faction-item")
                    .attr("data-faction-id", conn.id)
                    .style("padding", "0.5rem")
                    .style("margin-bottom", "0.25rem")
                    .style("border-left", `3px solid ${conn.relationshipType === 'ally' ? '#22c55e' : '#ef4444'}`)
                    .style("background", isSelected ? "#dbeafe" : "#f8fafc")
                    .style("border-radius", "4px")
                    .style("font-size", "0.8rem")
                    .style("cursor", "pointer")
                    .style("transition", "all 0.2s ease")
                    .on("mouseenter", function () {
                        if (!isSelected) {
                            d3.select(this).style("background", "#e0e7ff");
                        }
                    })
                    .on("mouseleave", function () {
                        if (!isSelected) {
                            d3.select(this).style("background", "#f8fafc");
                        }
                    })
                    .on("click", function () {
                        const clickedId = conn.id;

                        // Toggle selection
                        if (viewState.selectedConnectedFaction === clickedId) {
                            viewState.selectedConnectedFaction = null;
                        } else {
                            viewState.selectedConnectedFaction = clickedId;
                        }

                        // Update visual selection
                        connectionsList.selectAll(".connected-faction-item")
                            .style("background", function () {
                                const itemId = d3.select(this).attr("data-faction-id");
                                return viewState.selectedConnectedFaction === itemId ? "#dbeafe" : "#f8fafc";
                            });

                        // Update charts with filter
                        updateFactionChartsWithFilter(factionData, factionEvents, connectedFactions);
                    });

                connItem.append("div")
                    .style("font-weight", "600")
                    .style("color", "#1e293b")
                    .style("margin-bottom", "0.15rem")
                    .text(conn.id.length > 30 ? conn.id.substring(0, 27) + "..." : conn.id);

                connItem.append("div")
                    .style("font-size", "0.75rem")
                    .style("color", "#64748b")
                    .html(`
                        <span style="color: ${conn.relationshipType === 'ally' ? '#22c55e' : '#ef4444'}; font-weight: 600;">${conn.relationshipType === 'ally' ? 'Ally' : 'Opponent'}</span> • 
                        ${conn.country} • <span style="color: #ef4444;">${d3.format(",d")(conn.casualties)}</span> casualties
                    `);
            });
    }

    // Display faction charts in right panel
    displayFactionCharts(factionData, factionEvents);
}

// Display faction charts in right panel (like country view)
function displayFactionCharts(factionData, factionEvents) {
    const chartsPanel = d3.select("#charts-panel");
    chartsPanel.style("display", "flex");
    chartsPanel.selectAll("*").remove();

    // Determine header text based on country filter
    const countryFilter = viewState.selectedCountryInFaction;
    const headerTitle = countryFilter
        ? `Statistics in ${countryFilter}`
        : "Faction Statistics";
    const subTitle = countryFilter
        ? `${factionData.id} - ${factionEvents.length} events`
        : factionData.id;

    // Header
    chartsPanel.append("div")
        .attr("class", "charts-header")
        .html(`
            <h3 id="charts-title" style="margin: 0 0 5px 0; font-size: 18px;">${headerTitle}</h3>
            <p style="margin: 0; font-size: 14px; color: #64748b;">${subTitle}</p>
        `);

    if (factionEvents.length === 0) {
        chartsPanel.append("div")
            .style("padding", "2rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No event data available for this faction");
        return;
    }

    // Chart 1: Timeline
    const timelineContainer = chartsPanel.append("div")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem");
    timelineContainer.append("h4").style("margin", "0 0 10px 0").text("Casualties Over Time");
    const timelineSvg = timelineContainer.append("svg")
        .attr("id", "faction-chart-timeline")
        .attr("class", "stat-chart")
        .attr("width", 380)
        .attr("height", 150);
    renderFactionChartTimeline(factionEvents, timelineSvg);

    // Chart 2: Connected Factions Casualties (Stacked Bar)
    const connContainer = chartsPanel.append("div")
        .attr("id", "faction-connected-chart-container")
        .attr("class", "chart-container")
        .style("margin-bottom", "1rem");
    connContainer.append("h4").style("margin", "0 0 10px 0").text("Conflicts with Connected Factions");
    const connChartDiv = connContainer.append("div")
        .attr("id", "faction-connected-chart");
    renderConnectedFactionsChart(factionData, factionEvents, window.currentConnectedFactions || []);

    // Chart 3: Top Events
    const eventsContainer = chartsPanel.append("div")
        .attr("class", "chart-container");
    eventsContainer.append("h4").style("margin", "0 0 10px 0").text("Most Severe Events");
    const eventsList = eventsContainer.append("div")
        .attr("id", "faction-chart-events")
        .attr("class", "events-list");
    renderFactionChartTopEvents(factionEvents, eventsList);
}

// Update charts when connected faction filter changes
function updateFactionChartsWithFilter(factionData, factionEvents, connectedFactions) {
    const selectedFilter = viewState.selectedConnectedFaction;

    // Update the connected factions chart
    const connChartDiv = d3.select("#faction-connected-chart");
    connChartDiv.html("");

    // Determine filtered events
    let filteredEvents = factionEvents;
    if (selectedFilter) {
        filteredEvents = factionEvents.filter(e => {
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(selectedFilter) || sideB.includes(selectedFilter);
        });
    }

    if (selectedFilter) {
        // Show detailed casualty breakdown for main faction vs selected
        renderCasualtyBreakdownChart(factionData, factionEvents, selectedFilter);

        // Get relationship type for title
        const selectedFactionInfo = connectedFactions.find(f => f.id === selectedFilter);
        const isAlly = selectedFactionInfo && selectedFactionInfo.relationshipType === 'ally';
        const relationLabel = isAlly ? "With Ally" : "vs Opponent";

        // Update chart title with relationship
        const shortFilter = selectedFilter.length > 25 ? selectedFilter.substring(0, 22) + '...' : selectedFilter;
        d3.select("#faction-connected-chart-container h4").text(`${relationLabel}: ${shortFilter}`);

        // UPDATE TIMELINE CHART with filtered events
        const timelineSvg = d3.select("#faction-chart-timeline");
        timelineSvg.selectAll("*").remove();
        renderFactionChartTimeline(filteredEvents, timelineSvg);

        // UPDATE TOP EVENTS with filtered events
        const eventsList = d3.select("#faction-chart-events");
        eventsList.selectAll("*").remove();
        renderFactionChartTopEvents(filteredEvents, eventsList);

        // Filter bubbles on map if in map view
        filterEventBubblesOnMap(filteredEvents);
    } else {
        // Show bar chart of all connected factions
        renderConnectedFactionsChart(factionData, factionEvents, connectedFactions);

        // Reset event bubbles on map
        filterEventBubblesOnMap(null);

        // Reset chart title
        d3.select("#faction-connected-chart-container h4").text("Conflicts with Connected Factions");

        // RESET TIMELINE CHART to all events
        const timelineSvg = d3.select("#faction-chart-timeline");
        timelineSvg.selectAll("*").remove();
        renderFactionChartTimeline(factionEvents, timelineSvg);

        // RESET TOP EVENTS to all events
        const eventsList = d3.select("#faction-chart-events");
        eventsList.selectAll("*").remove();
        renderFactionChartTopEvents(factionEvents, eventsList);
    }
}

// Filter event bubbles on map to show only relevant events
// Called when connected faction filter is applied/removed
function filterEventBubblesOnMap(filteredEvents) {
    const allBubbles = bubblesGroup.selectAll(".event-bubble");

    if (!filteredEvents || filteredEvents.length === 0) {
        // No filter: show all bubbles at full opacity
        allBubbles
            .classed("filtered-out", false)
            .style("opacity", 0.7)
            .style("fill", d => TYPE_COLORS[d.type_of_violence_name]);
        return;
    }

    // Create a Set of filtered event identifiers for fast lookup
    // Use multiple properties for more reliable matching
    const filteredIds = new Set(filteredEvents.map(e =>
        `${e.country}-${e.year}-${e.longitude?.toFixed(4)}-${e.latitude?.toFixed(4)}-${e.best}`
    ));

    // Update each bubble's visibility
    allBubbles.each(function (d) {
        const eventId = `${d.country}-${d.year}-${d.longitude?.toFixed(4)}-${d.latitude?.toFixed(4)}-${d.best}`;
        const isFiltered = filteredIds.has(eventId);

        d3.select(this)
            .classed("filtered-out", !isFiltered)
            .style("opacity", isFiltered ? 0.8 : 0.15)
            .style("fill", isFiltered ? TYPE_COLORS[d.type_of_violence_name] : "#94a3b8");
    });
}

// Render HORIZONTAL bar chart for connected factions casualties
function renderConnectedFactionsChart(factionData, factionEvents, connectedFactions) {
    const container = d3.select("#faction-connected-chart");
    container.html("");

    if (!connectedFactions || connectedFactions.length === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No connected factions data");
        return;
    }

    // Get top connected factions by casualties
    const topFactions = connectedFactions
        .sort((a, b) => b.casualties - a.casualties)
        .slice(0, 8);

    const maxCasualties = d3.max(topFactions, d => d.casualties) || 1;

    // Horizontal bar list (no SVG, just HTML for better readability)
    const barList = container.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "0.5rem");

    topFactions.forEach(faction => {
        const barRow = barList.append("div")
            .attr("class", "conn-faction-bar-row")
            .attr("data-faction-id", faction.id)
            .style("cursor", "pointer")
            .style("padding", "0.5rem")
            .style("background", viewState.selectedConnectedFaction === faction.id ? "#dbeafe" : "#f8fafc")
            .style("border-radius", "6px")
            .style("transition", "all 0.2s ease")
            .on("mouseenter", function () {
                if (viewState.selectedConnectedFaction !== faction.id) {
                    d3.select(this).style("background", "#e0e7ff");
                }
            })
            .on("mouseleave", function () {
                if (viewState.selectedConnectedFaction !== faction.id) {
                    d3.select(this).style("background", "#f8fafc");
                }
            })
            .on("click", function () {
                // Toggle filter - same as clicking in connected factions list
                if (viewState.selectedConnectedFaction === faction.id) {
                    viewState.selectedConnectedFaction = null;
                } else {
                    viewState.selectedConnectedFaction = faction.id;
                }
                // Update both the list and chart
                d3.selectAll(".connected-faction-item")
                    .style("background", function () {
                        const itemId = d3.select(this).attr("data-faction-id");
                        return viewState.selectedConnectedFaction === itemId ? "#dbeafe" : "#f8fafc";
                    });
                updateFactionChartsWithFilter(factionData, factionEvents, connectedFactions);
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
                <span style="font-size: 0.8rem; color: ${faction.relationshipType === 'ally' ? '#22c55e' : '#ef4444'}; font-weight: 600;">
                    ${faction.relationshipType === 'ally' ? 'Ally' : 'Opponent'}
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
            .style("background", faction.relationshipType === 'ally' ?
                "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)" :
                "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)")
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

// Render detailed casualty breakdown when filter is active
function renderCasualtyBreakdownChart(factionData, factionEvents, selectedFactionId) {
    const container = d3.select("#faction-connected-chart");
    container.html("");

    // Get relationship type for selected faction
    const connectedFactions = window.currentConnectedFactions || [];
    const selectedFactionInfo = connectedFactions.find(f => f.id === selectedFactionId);
    const isAlly = selectedFactionInfo && selectedFactionInfo.relationshipType === 'ally';

    // Filter events involving the selected faction
    const relevantEvents = factionEvents.filter(e => {
        const sideA = e.side_a || '';
        const sideB = e.side_b || '';
        return sideA.includes(selectedFactionId) || sideB.includes(selectedFactionId);
    });

    // FILTER EVENT BUBBLES ON MAP
    filterEventBubblesOnMap(relevantEvents);

    if (relevantEvents.length === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No direct conflicts found");
        return;
    }

    // Calculate totals with faction name logic
    const totalDeathsA = d3.sum(relevantEvents, e => e.deaths_a || 0);
    const totalDeathsB = d3.sum(relevantEvents, e => e.deaths_b || 0);
    const totalCivilians = d3.sum(relevantEvents, e => e.deaths_civilians || 0);
    const totalUnknown = d3.sum(relevantEvents, e => e.deaths_unknown || 0);
    const total = totalDeathsA + totalDeathsB + totalCivilians + totalUnknown;

    if (total === 0) {
        container.append("div")
            .style("padding", "1rem")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .text("No casualty data available");
        return;
    }

    // Build categories based on ally/opponent relationship
    let categories;
    if (isAlly) {
        // ALLY: Show combined (main + ally) vs opponents
        const allyTotal = totalDeathsA + totalDeathsB; // Both are on "our side"
        const mainFactionName = factionData.id.length > 20 ? factionData.id.substring(0, 17) + '...' : factionData.id;
        const allyName = selectedFactionId.length > 20 ? selectedFactionId.substring(0, 17) + '...' : selectedFactionId;

        categories = [
            {
                label: `${mainFactionName} + ${allyName}`,
                fullLabel: `Combined: ${factionData.id} and ${selectedFactionId}`,
                value: allyTotal,
                color: "#22c55e",
                percent: allyTotal / total
            },
            { label: "Civilian Casualties", fullLabel: "Civilian Casualties", value: totalCivilians, color: "#dc2626", percent: totalCivilians / total },
            { label: "Unknown Affiliation", fullLabel: "Unknown Affiliation", value: totalUnknown, color: "#78716c", percent: totalUnknown / total }
        ].filter(c => c.value > 0);
    } else {
        // OPPONENT: Show main faction vs opponent
        const mainFactionName = factionData.id.length > 25 ? factionData.id.substring(0, 22) + '...' : factionData.id;
        const opponentName = selectedFactionId.length > 25 ? selectedFactionId.substring(0, 22) + '...' : selectedFactionId;

        categories = [
            { label: mainFactionName, fullLabel: factionData.id, value: totalDeathsA, color: "#ef4444", percent: totalDeathsA / total },
            { label: opponentName, fullLabel: selectedFactionId, value: totalDeathsB, color: "#3b82f6", percent: totalDeathsB / total },
            { label: "Civilian Casualties", fullLabel: "Civilian Casualties", value: totalCivilians, color: "#dc2626", percent: totalCivilians / total },
            { label: "Unknown Affiliation", fullLabel: "Unknown Affiliation", value: totalUnknown, color: "#78716c", percent: totalUnknown / total }
        ].filter(c => c.value > 0);
    }

    // Summary header
    container.append("div")
        .style("text-align", "center")
        .style("padding", "0.5rem")
        .style("background", isAlly ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)")
        .style("border-radius", "6px")
        .style("margin-bottom", "1rem")
        .html(`
            <strong style="color: ${isAlly ? '#22c55e' : '#ef4444'}; font-size: 1.5rem;">${d3.format(",d")(total)}</strong><br>
            <span style="color: #64748b; font-size: 0.8rem;">Total Casualties (${relevantEvents.length} events)</span><br>
            <span style="font-size: 0.75rem; color: ${isAlly ? '#22c55e' : '#ef4444'}; font-weight: 500;">${isAlly ? 'Allies' : 'Opponents'}</span>
        `);

    // Horizontal bar list (like the main chart)
    const barList = container.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "0.5rem");

    const maxValue = d3.max(categories, c => c.value) || 1;

    categories.forEach(cat => {
        const barRow = barList.append("div")
            .style("padding", "0.5rem")
            .style("background", "#f8fafc")
            .style("border-radius", "6px")
            .style("border-left", `4px solid ${cat.color}`);

        // Label row
        barRow.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("margin-bottom", "0.25rem")
            .html(`
                <span style="font-size: 0.8rem; font-weight: 600; color: #1e293b;" title="${cat.fullLabel}">
                    ${cat.label}
                </span>
                <span style="font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    ${d3.format(",d")(cat.value)} <span style="font-size: 0.7rem; color: #94a3b8;">(${d3.format(".1%")(cat.percent)})</span>
                </span>
            `);

        // Horizontal bar
        const barPercent = (cat.value / maxValue) * 100;
        barRow.append("div")
            .style("height", "10px")
            .style("background", "#e2e8f0")
            .style("border-radius", "5px")
            .style("overflow", "hidden")
            .append("div")
            .style("height", "100%")
            .style("width", `${barPercent}%`)
            .style("background", cat.color)
            .style("border-radius", "5px");
    });
}
function renderFactionChartTimeline(events, svg) {
    const width = 380, height = 150;
    const margin = { top: 15, right: 15, bottom: 25, left: 45 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const yearData = d3.rollup(events, v => d3.sum(v, e => e.best), d => d.year);
    const data = Array.from(yearData, ([year, casualties]) => ({ year, casualties }))
        .sort((a, b) => a.year - b.year);

    if (data.length === 0) return;

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.casualties)])
        .range([chartHeight, 0]);

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.casualties));

    const area = d3.area()
        .x(d => x(d.year))
        .y0(chartHeight)
        .y1(d => y(d.casualties));

    g.append("path").datum(data)
        .attr("fill", "rgba(239, 68, 68, 0.2)")
        .attr("d", area);

    g.append("path").datum(data)
        .attr("fill", "none")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("d", line);

    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(5))
        .style("font-size", "9px");

    g.append("g")
        .call(d3.axisLeft(y).ticks(4))
        .style("font-size", "9px");
}

// Render violence type pie chart for faction
function renderFactionChartType(events, svg) {
    const width = 380, height = 150;
    const radius = Math.min(width, height) / 2 - 20;

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    const data = d3.rollup(events, v => v.length, d => d.type_of_violence_name);

    const pie = d3.pie().value(d => d[1]).sort(null);
    const arc = d3.arc().innerRadius(20).outerRadius(radius);

    const arcs = g.selectAll(".arc")
        .data(pie(Array.from(data)))
        .join("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => TYPE_COLORS[d.data[0]] || "#64748b")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("fill", "white")
        .style("font-weight", "600")
        .text(d => d.data[1] > 3 ? d.data[1] : "");
}

// Navigate from Graph View to Faction Map View and select specific event
function navigateToFactionViewWithEvent(event) {
    // Get current focused faction
    const factionId = graphFilterState.focusedFaction;
    if (!factionId) {
        console.warn('No focused faction found, falling back to event details');
        selectFactionEvent(event);
        return;
    }

    // Build faction data object
    const graphSvg = d3.select("#graph-svg");
    const allNodes = graphSvg.selectAll(".graph-node").data();
    const factionNode = allNodes.find(n => n.id === factionId);

    if (!factionNode) {
        console.warn('Faction node not found:', factionId);
        selectFactionEvent(event);
        return;
    }

    // Navigate to faction map view
    navigateToFactionDetailView(factionNode);

    // After map loads, zoom to event's country and select event
    setTimeout(() => {
        const countryName = event.country;
        const countryFeature = findCountryFeature(countryName);

        if (countryFeature) {
            // Update viewState for country filter
            viewState.selectedCountryInFaction = countryName;

            // Zoom to country
            zoomToCountryForFaction(countryFeature);

            // After zoom, draw individual events and select the clicked one
            setTimeout(() => {
                const factionEvents = viewState.selectedFactionData.filter(e => e.country === countryName);
                bubblesGroup.selectAll("*").remove();
                drawFactionEventBubbles(factionEvents, 'country');

                // Update panels for country-specific view
                const gSvg = d3.select("#graph-svg");
                const nodes = gSvg.selectAll(".graph-node").data();
                const links = gSvg.selectAll("path").data();

                displayFactionInfo({
                    id: viewState.selectedFactionName,
                    region: event.region,
                    country: countryName,
                    selectedCountry: countryName
                }, nodes, links);

                // Select the specific event after bubbles are drawn
                setTimeout(() => {
                    selectFactionEvent(event);
                }, 300);
            }, 600);
        } else {
            // Country not found, just select the event
            setTimeout(() => {
                selectFactionEvent(event);
            }, 800);
        }
    }, 800);
}

// Render top events list for faction
function renderFactionChartTopEvents(events, container) {
    const topEvents = events
        .sort((a, b) => b.best - a.best)
        .slice(0, 8);

    topEvents.forEach((event, idx) => {
        const item = container.append("div")
            .attr("class", "event-item")
            .style("padding", "0.5rem")
            .style("border-bottom", "1px solid #e2e8f0")
            .style("cursor", "pointer")
            .style("transition", "background 0.2s")
            .on("mouseover", function () {
                d3.select(this).style("background", "#f1f5f9");
            })
            .on("mouseout", function () {
                d3.select(this).style("background", "transparent");
            })
            .on("click", function () {
                // Navigate to Map View and select this event
                navigateToFactionViewWithEvent(event);
            });

        item.append("div")
            .style("font-weight", "600")
            .style("font-size", "0.85rem")
            .style("color", "#1e293b")
            .text(`${idx + 1}. ${event.country} - ${event.dyad_name || "Conflict"}`);

        item.append("div")
            .style("font-size", "0.75rem")
            .style("color", "#64748b")
            .html(`
                ${event.year} • 
                <strong style="color: #ef4444;">${d3.format(",")(event.best)} casualties</strong> • 
                ${event.type_of_violence_name}
            `);
    });
}

// Show event details modal
function showEventModal(event) {
    const modal = document.getElementById('event-modal');
    if (!modal) {

        alert(`Event Details:\n\n${event.country} - ${event.dyad_name || 'Conflict'}\nYear: ${event.year}\nCasualties: ${event.best}\nType: ${event.type_of_violence_name}`);
        return;
    }

    // Populate modal
    const title = document.getElementById('modal-title');
    const date = document.getElementById('modal-date');
    const type = document.getElementById('modal-type');
    const casualties = document.getElementById('modal-casualties');
    const source = document.getElementById('modal-source');
    const headline = document.getElementById('modal-headline');
    const description = document.getElementById('modal-description');

    if (title) title.textContent = event.dyad_name || `${event.country} Conflict`;
    if (date) date.textContent = event.date_start || event.year;
    if (type) type.textContent = event.type_of_violence_name;
    if (casualties) casualties.textContent = d3.format(",")(event.best);
    if (source) source.textContent = event.source_article || 'UCDP GED Database';
    if (headline) headline.textContent = event.source_headline || 'N/A';
    if (description) description.textContent = event.source_original || 'No detailed description available.';

    // Show modal
    modal.style.display = 'flex';

    // Setup close button
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.onclick = function () {
            modal.style.display = 'none';
        };
    }

    // Close on outside click
    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function restoreLeftPanelContent(nodes) {
    const leftPanel = d3.select("#left-panel");

    // Remove faction info panel
    leftPanel.select("#faction-info-panel").remove();

    // Show normal content sections
    leftPanel.select(".stats-container").style("display", "block");
    leftPanel.select(".legend-section").style("display", "block");
    leftPanel.select(".violence-filter-section").style("display", "block");
    leftPanel.select("#relationship-filter-section").style("display", "block");

    // Restore faction rankings in right panel
    if (nodes && nodes.length > 0) {
        updateGraphStatistics(nodes);
        updateFactionRankings(nodes);
    }
}

// ============================================================================
// COMPATIBILITY AND UTILITY FUNCTIONS
// ============================================================================

// Wrapper function for compatibility with existing code
function initGraphView() {
    graphViewActive = true;
    initAllFactionsGraph();
    setupGraphFilters(); // Setup filter event listeners
}

// Update when filters change
function updateGraphView() {
    if (!allFactionsActive && !graphViewActive) return;

    // If faction is focused, update visibility instead of full redraw
    if (graphFilterState.focusedFaction) {
        updateFocusedFactionGraph();
        return;
    }

    // No focus - full redraw
    d3.select("#graph-svg").selectAll("*").remove();
    initAllFactionsGraph();
}

// Update focused faction graph - hide nodes/connections outside time range
function updateFocusedFactionGraph() {
    const factionId = graphFilterState.focusedFaction;
    if (!factionId) return;

    const currentYear = +document.getElementById('year-slider').value;

    // Rebuild faction data for current year to identify valid connections
    const { nodes: rebuiltNodes, links: rebuiltLinks } = buildAllFactionsData();

    // Get connected faction IDs from current year data
    const connectedIds = new Set();
    rebuiltLinks.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === factionId) connectedIds.add(targetId);
        if (targetId === factionId) connectedIds.add(sourceId);
    });

    // Check if focused faction still exists in current year
    const focusedFactionData = rebuiltNodes.find(n => n.id === factionId);

    // Always keep focused faction visible, even if it has no events yet
    // (but its connections might not exist yet)

    const graphSvg = d3.select("#graph-svg");

    // Update node visibility - completely hide (display:none) nodes outside time range
    // BUT always keep the focused faction visible
    graphSvg.selectAll(".graph-node")
        .transition().duration(300)
        .style("opacity", function (d) {
            if (d.id === factionId) return 1; // Focused faction always visible
            return connectedIds.has(d.id) ? 1 : 0;
        })
        .on("end", function (d) {
            // After transition, set display:none for hidden nodes
            if (d.id !== factionId && !connectedIds.has(d.id)) {
                d3.select(this).style("display", "none");
            } else {
                d3.select(this).style("display", "block");
            }
        });

    graphSvg.selectAll(".graph-node-label")
        .transition().duration(300)
        .style("opacity", function (d) {
            if (d.id === factionId) return 1; // Focused faction label always visible
            return connectedIds.has(d.id) ? 1 : 0;
        })
        .on("end", function (d) {
            if (d.id !== factionId && !connectedIds.has(d.id)) {
                d3.select(this).style("display", "none");
            } else {
                d3.select(this).style("display", "block");
            }
        });

    // Update link visibility - completely hide connections outside time range
    graphSvg.selectAll("path")
        .transition().duration(300)
        .style("stroke-opacity", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return 0;
            // Show link if it connects to focused faction AND connected node exists in current time
            const isConnectedToFocus = (sourceId === factionId || targetId === factionId);
            const connectedNodeExists = (sourceId === factionId && connectedIds.has(targetId)) ||
                (targetId === factionId && connectedIds.has(sourceId));
            return (isConnectedToFocus && connectedNodeExists) ? 0.8 : 0;
        })
        .on("end", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            const isConnectedToFocus = (sourceId === factionId || targetId === factionId);
            const connectedNodeExists = (sourceId === factionId && connectedIds.has(targetId)) ||
                (targetId === factionId && connectedIds.has(sourceId));
            if (isConnectedToFocus && connectedNodeExists) {
                d3.select(this).style("display", "block");
            } else {
                d3.select(this).style("display", "none");
            }
        });

    // Hide top countries panel (it should only show in global graph view)
    d3.select("#top-countries-section").style("display", "none");
    d3.select(".top-countries-list").style("display", "none");

    // Update panel info with new year's data using rebuilt (time-filtered) data
    if (focusedFactionData) {
        // Get time-filtered faction events for panels
        let factionEvents = rawData.filter(e => {
            if (e.year > currentYear) return false;
            const sideA = e.side_a || '';
            const sideB = e.side_b || '';
            return sideA.includes(factionId) || sideB.includes(factionId);
        });

        // Apply violence type filter if active
        if (viewState.selectedViolenceType) {
            factionEvents = factionEvents.filter(e =>
                e.type_of_violence_name === viewState.selectedViolenceType
            );
        }

        // Use rebuilt nodes for proper time-filtered connected factions calculation
        displayFactionInfo(focusedFactionData, rebuiltNodes, graphSvg.selectAll("path"));

        // ALSO update right panel charts with time-filtered events
        displayFactionCharts(focusedFactionData, factionEvents);
    }
}

// ============================================================================
// FACTION CLICK INTERACTION HANDLERS
// ============================================================================

function handleFactionClick(factionData, allNodes, linkSelection, nodeSelection, labelSelection) {
    const now = Date.now();
    const timeSinceLastClick = now - graphFilterState.lastClickTime;

    // Check if this is a second click on the same faction (within 500ms = double-click)
    if (graphFilterState.lastClickedFaction === factionData.id && timeSinceLastClick < 500) {
        // Second click on same faction -> navigate to detail view
        navigateToFactionDetailView(factionData);
        return;
    }

    // First click or click on different faction -> activate focus mode
    graphFilterState.lastClickedFaction = factionData.id;
    graphFilterState.lastClickTime = now;

    // Use the same focusOnFaction function that ranking list uses
    focusOnFaction(factionData);
}

// Navigate to faction detail view with map showing faction's conflicts
function navigateToFactionDetailView(factionData) {


    // Get faction events
    const currentYear = +document.getElementById('year-slider').value;
    let factionEvents = rawData.filter(e => {
        if (e.year > currentYear) return false;
        const sideA = e.side_a || '';
        const sideB = e.side_b || '';
        return sideA.includes(factionData.id) || sideB.includes(factionData.id);
    });

    // Apply violence type filter if active
    if (viewState.selectedViolenceType) {
        factionEvents = factionEvents.filter(e => e.type_of_violence_name === viewState.selectedViolenceType);
    }

    if (factionEvents.length === 0) {

        return;
    }

    // Get unique countries
    const countries = [...new Set(factionEvents.map(e => e.country))].sort();

    // Hide graph container, show world map
    const graphContainer = document.getElementById('graph-container');
    const worldMap = document.getElementById('world-map');

    if (graphContainer) graphContainer.style.display = 'none';
    if (worldMap) worldMap.style.display = 'block';

    // Store faction data for reference (reset country filter)
    viewState.mode = 'faction';
    viewState.selectedFactionName = factionData.id;
    viewState.selectedFaction = factionData.id;
    viewState.selectedFactionData = factionEvents;
    viewState.selectedCountryInFaction = null; // Clear any previous country filter

    // Clear existing bubbles
    if (bubblesGroup) bubblesGroup.selectAll("*").remove();

    // Determine view type and zoom accordingly
    if (countries.length === 1) {
        // Single country: zoom to that country, show individual events
        const countryFeature = findCountryFeature(countries[0]);
        if (countryFeature) {
            zoomToCountryForFaction(countryFeature);
            setTimeout(() => {
                drawFactionEventBubbles(factionEvents, 'country');
            }, 600);
        } else {
            drawFactionEventBubbles(factionEvents, 'country');
        }
    } else {
        // Multiple countries: check if regional or global
        const bounds = calculateEventsBounds(factionEvents);
        if (bounds && isRegionalCluster(bounds)) {
            // Regional cluster: zoom to bounds, show country bubbles
            zoomToBoundsForFaction(bounds);
            setTimeout(() => {
                drawFactionCountryBubbles(factionEvents, countries);
            }, 600);
        } else {
            // Global dispersion: world view, show country bubbles
            resetMapZoomForFaction();
            setTimeout(() => {
                drawFactionCountryBubbles(factionEvents, countries);
            }, 400);
        }
    }

    // Update left panel with faction info (using graph.js version)
    const graphSvg = d3.select("#graph-svg");
    const allNodes = graphSvg.selectAll(".graph-node").data();
    const links = graphSvg.selectAll("path").data();
    displayFactionInfo(factionData, allNodes, links);

    // Update right panel with faction charts
    displayFactionCharts(factionData, factionEvents);

    // Show reset button
    d3.select("#reset-zoom")
        .style("display", "block")
        .text("← Back")
        .on("click", function () {
            // Hide map, show graph
            if (worldMap) worldMap.style.display = 'none';
            if (graphContainer) graphContainer.style.display = 'block';
            d3.select(this).style("display", "none");

            // Clear map bubbles
            if (bubblesGroup) bubblesGroup.selectAll("*").remove();

            // Reset map
            resetMapZoomForFaction();

            // Restore graph view
            const gSvg = d3.select("#graph-svg");
            const nodes = gSvg.selectAll(".graph-node").data();
            restoreLeftPanelContent(nodes);

            // Reset view state
            viewState.mode = 'world';
            viewState.selectedFaction = null;
            viewState.selectedFactionName = null;
            viewState.selectedFactionData = null;
            viewState.selectedCountryInFaction = null;
        });
}

// ============================================================================
// COUNTRY FEATURE FINDING FOR FACTION VIEW
// ============================================================================

// Helper function to find country feature from worldMapFeatures
function findCountryFeature(countryName) {
    if (!worldMapFeatures || !countryName) return null;

    // Country name mapping (CSV name -> TopoJSON name)
    const countryMapping = {
        // Africa
        "DR Congo (Zaire)": "Dem. Rep. Congo",
        "South Sudan": "S. Sudan",
        "Central African Republic": "Central African Rep.",
        "Equatorial Guinea": "Eq. Guinea",
        "Kingdom of eSwatini (Swaziland)": "eSwatini",
        "Ivory Coast": "Côte d'Ivoire",

        // Asia
        "Laos": "Lao PDR",
        "Myanmar (Burma)": "Myanmar",
        "Timor-Leste (East Timor)": "Timor-Leste",
        "North Korea": "Dem. Rep. Korea",
        "South Korea": "Korea",

        // Europe
        "Bosnia-Herzegovina": "Bosnia and Herz.",
        "North Macedonia": "Macedonia",
        "Czech Republic": "Czechia",

        // Americas
        "United States": "United States of America",
        "USA": "United States of America",
        "Dominican Republic": "Dominican Rep.",
    };

    // Helper for normalization
    const normalize = str => str.toLowerCase()
        .replace(/\bthe\b/g, '')
        .replace(/\brepublic of\b/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Try exact match
    let countryFeature = worldMapFeatures.find(f => f.properties.name === countryName);

    // 2. Try mapped name
    if (!countryFeature && countryMapping[countryName]) {
        countryFeature = worldMapFeatures.find(f => f.properties.name === countryMapping[countryName]);
    }

    // 3. Try normalized match
    if (!countryFeature) {
        const normalizedTarget = normalize(countryName);
        countryFeature = worldMapFeatures.find(f => normalize(f.properties.name) === normalizedTarget);
    }

    // 4. Try partial match
    if (!countryFeature) {
        const targetLower = countryName.toLowerCase();
        countryFeature = worldMapFeatures.find(f => {
            const nameLower = f.properties.name.toLowerCase();
            return nameLower.includes(targetLower) || targetLower.includes(nameLower);
        });
    }

    return countryFeature;
}

// Zoom to country for faction view
function zoomToCountryForFaction(countryFeature) {
    if (!countryFeature || !path) return;

    const bounds = path.bounds(countryFeature);
    if (!bounds || !bounds[0] || !bounds[1]) return;

    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    if (dx === 0 || dy === 0) return;

    const scale = Math.max(2, Math.min(300, 0.9 / Math.max(dx / mapWidth, dy / mapHeight)));
    viewState.zoomScale = scale;

    const translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

// Zoom to bounds for faction view
function zoomToBoundsForFaction(bounds) {
    if (!bounds || !projection) return;

    const p1 = projection([bounds.minLon, bounds.minLat]);
    const p2 = projection([bounds.maxLon, bounds.maxLat]);
    if (!p1 || !p2) return;

    const dx = Math.abs(p2[0] - p1[0]);
    const dy = Math.abs(p2[1] - p1[1]);
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;

    const scale = Math.max(1.2, Math.min(8, 0.8 / Math.max(dx / mapWidth, dy / mapHeight)));
    viewState.zoomScale = scale;

    const translate = [mapWidth / 2 - scale * cx, mapHeight / 2 - scale * cy];

    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

// Reset map zoom for faction view
function resetMapZoomForFaction() {
    viewState.zoomScale = 1;
    if (svg && zoom) {
        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity);
    }
}

// Draw individual event bubbles for faction (country view level)
function drawFactionEventBubbles(events, viewLevel) {
    const eventsWithCoords = events.filter(e => e.latitude != null && e.longitude != null);
    if (eventsWithCoords.length === 0) return;

    const maxCasualties = d3.max(eventsWithCoords, e => e.best) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [3 / zoomFactor, 20 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".event-bubble")
        .data(eventsWithCoords, d => `${d.country}-${d.year}-${d.latitude}-${d.longitude}`)
        .join(
            enter => enter.append("circle")
                .attr("class", "event-bubble")
                .attr("cx", d => projection([d.longitude, d.latitude])[0])
                .attr("cy", d => projection([d.longitude, d.latitude])[1])
                .attr("r", 0)
                .style("fill", d => TYPE_COLORS[d.type_of_violence_name] || "#ef4444")
                .style("fill-opacity", 0.7)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    event.stopPropagation();
                    selectFactionEvent(d);
                })
                .call(enter => enter.transition()
                    .duration(600)
                    .attr("r", d => radiusScale(d.best))),
            update => update,
            exit => exit.remove()
        );

    // Add tooltips
    bubblesGroup.selectAll(".event-bubble")
        .append("title")
        .text(d => `${d.country}\n${d.dyad_name || 'Conflict'}\n${d.year} • ${d.type_of_violence_name}\n${d3.format(",")(d.best)} casualties`);
}

// Draw country-level bubbles for faction (region/world view level)
function drawFactionCountryBubbles(events, countries) {
    const countryData = countries.map(country => {
        const countryEvents = events.filter(e => e.country === country);
        const lats = countryEvents.map(e => e.latitude).filter(l => l != null);
        const lons = countryEvents.map(e => e.longitude).filter(l => l != null);
        return {
            country: country,
            latitude: d3.mean(lats),
            longitude: d3.mean(lons),
            events: countryEvents,
            casualties: d3.sum(countryEvents, e => e.best),
            eventCount: countryEvents.length
        };
    }).filter(d => d.latitude && d.longitude);

    const maxCasualties = d3.max(countryData, d => d.casualties) || 1;
    const zoomFactor = viewState.zoomScale || 1;
    const baseRange = [8 / zoomFactor, 40 / zoomFactor];

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range(baseRange);

    bubblesGroup.selectAll(".country-bubble")
        .data(countryData, d => d.country)
        .join(
            enter => enter.append("circle")
                .attr("class", "country-bubble")
                .attr("cx", d => projection([d.longitude, d.latitude])[0])
                .attr("cy", d => projection([d.longitude, d.latitude])[1])
                .attr("r", 0)
                .style("fill", REGION_COLORS[viewState.selectedFactionData?.[0]?.region] || "#3b82f6")
                .style("fill-opacity", 0.7)
                .style("stroke", "#fff")
                .style("stroke-width", 2)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    event.stopPropagation();
                    // Store selected country
                    viewState.selectedCountryInFaction = d.country;

                    // Zoom to this country and show individual events
                    const countryFeature = findCountryFeature(d.country);
                    if (countryFeature) {
                        zoomToCountryForFaction(countryFeature);
                        setTimeout(() => {
                            // Clear ALL bubbles (including country bubbles)
                            bubblesGroup.selectAll("*").remove();

                            // Draw individual event bubbles for this country
                            drawFactionEventBubbles(d.events, 'country');

                            // Fully refresh left panel with country-specific info
                            const graphSvg = d3.select("#graph-svg");
                            const allNodes = graphSvg.selectAll(".graph-node").data();
                            const links = graphSvg.selectAll("path").data();
                            // Pass selectedCountry property for title display
                            displayFactionInfo({
                                id: viewState.selectedFactionName,
                                region: d.events[0]?.region,
                                country: d.country,
                                selectedCountry: d.country
                            }, allNodes, links);

                            // Update charts with this country's events only
                            // Pass selectedCountry property for title display
                            displayFactionCharts({
                                id: viewState.selectedFactionName,
                                selectedCountry: d.country
                            }, d.events);
                        }, 600);
                    }
                })
                .call(enter => enter.transition()
                    .duration(600)
                    .attr("r", d => radiusScale(d.casualties))),
            update => update,
            exit => exit.remove()
        );

    // Add tooltips
    bubblesGroup.selectAll(".country-bubble")
        .append("title")
        .text(d => `${d.country}\n${d.eventCount} events\n${d3.format(",")(d.casualties)} casualties\nClick to zoom`);
}


// Draw individual event bubbles with violence type colors
function drawIndividualEvents(events, bubblesGroup, projection, width) {
    const maxCasualties = d3.max(events, d => d.best) || 1;
    const sizeScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([3, Math.min(25, width / 30)]);

    bubblesGroup.selectAll("circle")
        .data(events.filter(d => d.latitude && d.longitude))
        .join("circle")
        .attr("class", "event-bubble")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => sizeScale(d.best))
        .style("fill", d => TYPE_COLORS[d.type_of_violence_name] || "#ef4444")
        .style("fill-opacity", 0.7)
        .style("stroke", "#fff")
        .style("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 1)
                .attr("r", sizeScale(d.best) * 1.3);
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 0.7)
                .attr("r", sizeScale(d.best));
        })
        .on("click", function (event, d) {
            showEventModal(d);
        })
        .append("title")
        .text(d => `${d.country}\n${d.dyad_name || 'Conflict'}\n${d.year} • ${d.type_of_violence_name}\n${d3.format(",")(d.best)} casualties`);
}

// Draw country-level bubbles for global view
function drawCountryBubbles(events, countries, bubblesGroup, projection, factionData, svg, mapGroup, width, height) {
    const countryData = countries.map(country => {
        const countryEvents = events.filter(e => e.country === country);
        const lats = countryEvents.map(e => e.latitude).filter(l => l);
        const lons = countryEvents.map(e => e.longitude).filter(l => l);
        return {
            country: country,
            latitude: d3.mean(lats),
            longitude: d3.mean(lons),
            events: countryEvents,
            casualties: d3.sum(countryEvents, e => e.best)
        };
    }).filter(d => d.latitude && d.longitude);

    const maxCasualties = d3.max(countryData, d => d.casualties) || 1;
    const sizeScale = d3.scaleSqrt()
        .domain([0, maxCasualties])
        .range([8, 40]);

    bubblesGroup.selectAll("circle")
        .data(countryData)
        .join("circle")
        .attr("class", "country-bubble")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => sizeScale(d.casualties))
        .style("fill", REGION_COLORS[factionData.region] || "#3b82f6")
        .style("fill-opacity", 0.7)
        .style("stroke", "#fff")
        .style("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 1)
                .attr("r", sizeScale(d.casualties) * 1.2);
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 0.7)
                .attr("r", sizeScale(d.casualties));
        })
        .on("click", function (event, d) {
            // Zoom to this country and show individual events
            const countryFeature = worldMapFeatures.find(f => f.properties.name === d.country);
            if (countryFeature) {
                zoomToCountryInFactionMap(countryFeature, factionData, events, svg, mapGroup, bubblesGroup, width, height);
            }
        })
        .append("title")
        .text(d => `${d.country}\n${d.events.length} events\n${d3.format(",")(d.casualties)} casualties\nClick to zoom`);
}

// Zoom to specific country in faction map view
function zoomToCountryInFactionMap(countryFeature, factionData, allEvents, svg, mapGroup, bubblesGroup, width, height) {
    const countryName = countryFeature.properties.name;
    const countryEvents = allEvents.filter(e => e.country === countryName);

    if (countryEvents.length === 0) return;

    // Calculate bounds
    const lats = countryEvents.map(e => e.latitude).filter(l => l);
    const lons = countryEvents.map(e => e.longitude).filter(l => l);
    const centerLon = d3.mean(lons);
    const centerLat = d3.mean(lats);

    // Create zoomed projection
    const zoomedProjection = d3.geoMercator()
        .center([centerLon, centerLat])
        .scale(width / 2)
        .translate([width / 2, height / 2]);

    // Clear and redraw with zoomed projection
    bubblesGroup.selectAll("*").remove();
    drawIndividualEvents(countryEvents, bubblesGroup, zoomedProjection, width);

    // Update panel with filtered info
    filterFactionByCountry(factionData, countryName, allEvents);
}


// Filter faction info by selected country
function filterFactionByCountry(factionData, countryName, allFactionEvents) {
    const filteredEvents = allFactionEvents.filter(e => e.country === countryName);

    if (filteredEvents.length === 0) {

        return;
    }

    // Update left panel with filtered info
    const leftPanel = d3.select("#left-panel");

    // Update existing faction panel title
    leftPanel.select("#faction-info-panel h3")
        .text(`Faction Details - ${countryName}`);

    // Update charts with filtered data
    displayFactionCharts(factionData, filteredEvents);

    // Show notification
    leftPanel.select("#faction-info-panel").insert("div", ":first-child")
        .attr("class", "country-filter-notice")
        .style("background", "#fef3c7")
        .style("border", "1px solid #fcd34d")
        .style("padding", "0.5rem")
        .style("border-radius", "6px")
        .style("margin-bottom", "1rem")
        .style("font-size", "0.8rem")
        .style("color", "#92400e")
        .html(`<strong>Filtered by:</strong> ${countryName} (${filteredEvents.length} events, ${d3.format(",d")(d3.sum(filteredEvents, e => e.best))} casualties) 
               <button style="float:right;background:#92400e;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;" 
                       onclick="this.parentElement.remove(); displayFactionCharts(window.currentFactionData, window.allFactionEvents);">✕ Clear</button>`);

    // Store for clear filter
    window.currentFactionData = factionData;
    window.allFactionEvents = allFactionEvents;
}

function applyFocusMode(factionData, allNodes, linkSelection, nodeSelection, labelSelection) {
    const focusedId = factionData.id;

    // Find all directly connected faction IDs
    const connectedIds = new Set([focusedId]);

    linkSelection.each(function (d) {
        const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
        const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;

        if (!sourceId || !targetId) return;
        if (sourceId === focusedId) connectedIds.add(targetId);
        if (targetId === focusedId) connectedIds.add(sourceId);
    });

    // Hide nodes that are not connected (completely hide, not just dim)
    nodeSelection
        .classed("focused-node", d => d && d.id === focusedId)
        .classed("connected-node", d => d && connectedIds.has(d.id) && d.id !== focusedId)
        .classed("dimmed-node", d => d && !connectedIds.has(d.id))
        .transition()
        .duration(300)
        .style("opacity", d => d && connectedIds.has(d.id) ? 1 : 0)
        .style("display", d => d && connectedIds.has(d.id) ? "block" : "none");

    // Hide labels for hidden nodes
    labelSelection
        .transition()
        .duration(300)
        .style("opacity", d => d && connectedIds.has(d.id) ? 1 : 0)
        .style("display", d => d && connectedIds.has(d.id) ? "block" : "none");

    // Hide links that are not connected to focused faction
    linkSelection
        .classed("focused-link", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return false;
            return sourceId === focusedId || targetId === focusedId;
        })
        .classed("dimmed-link", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return true;
            return sourceId !== focusedId && targetId !== focusedId;
        })
        .transition()
        .duration(300)
        .style("stroke-opacity", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return 0;
            if (sourceId === focusedId || targetId === focusedId) {
                return 0.8;
            }
            return 0;
        })
        .style("stroke", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return "#94a3b8";
            if (sourceId === focusedId || targetId === focusedId) {
                return d.type === 'ally' ? '#22c55e' : '#ef4444';
            }
            return "#94a3b8";
        })
        .style("display", function (d) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (!sourceId || !targetId) return "none";
            if (sourceId === focusedId || targetId === focusedId) {
                return "block";
            }
            return "none";
        });

    // Display faction info in left panel
    displayFactionInfo(factionData, allNodes, linkSelection);

    // Show back button in focus mode
    d3.select("#reset-zoom").style("display", "block");
}

function clearFocusMode() {
    graphFilterState.focusedFaction = null;
    graphFilterState.lastClickedFaction = null;

    const graphSvg = d3.select("#graph-svg");

    // Reset all nodes - restore display
    graphSvg.selectAll(".graph-node")
        .classed("focused-node", false)
        .classed("connected-node", false)
        .classed("dimmed-node", false)
        .transition()
        .duration(300)
        .style("opacity", 1)
        .style("display", "block");

    // Reset all labels - restore display
    graphSvg.selectAll(".graph-node-label")
        .transition()
        .duration(300)
        .style("opacity", 1)
        .style("display", "block");

    // Reset all links - restore display
    const edgeDensity = Math.min(1, graphSvg.selectAll("path").size() / 100);
    const baseOpacity = Math.max(0.3, 0.7 - edgeDensity * 0.4);

    graphSvg.selectAll("path")
        .classed("focused-link", false)
        .classed("dimmed-link", false)
        .transition()
        .duration(300)
        .style("stroke-opacity", baseOpacity)
        .style("stroke", d => d.type === 'ally' ? '#22c55e' : '#ef4444')
        .style("display", "block");

    // Restore left panel content
    const allNodes = graphSvg.selectAll(".graph-node").data();
    restoreLeftPanelContent(allNodes);

    // Hide back button and reset connected faction filter
    d3.select("#reset-zoom").style("display", "none");
    viewState.selectedConnectedFaction = null;

    // Hide charts panel (restored to default state)
    d3.select("#charts-panel").style("display", "none");
}

// Helper function to focus on a faction (called from ranking list)
function focusOnFaction(factionData) {
    const graphSvg = d3.select("#graph-svg");

    // Get all nodes, links, and labels
    const allNodes = graphSvg.selectAll(".graph-node").data();
    const linkSelection = graphSvg.selectAll("path");
    const nodeSelection = graphSvg.selectAll(".graph-node");
    const labelSelection = graphSvg.selectAll(".graph-node-label");

    // Apply focus mode
    applyFocusMode(factionData, allNodes, linkSelection, nodeSelection, labelSelection);

    // Update filter state
    graphFilterState.focusedFaction = factionData.id;
    graphFilterState.lastClickedFaction = factionData.id;
    graphFilterState.lastClickTime = Date.now();

    // Zoom to faction and its connections
    zoomToFaction(factionData, allNodes, linkSelection);
}

// Zoom and center the graph on a specific faction and its connections
function zoomToFaction(factionData, allNodes, linkSelection) {
    const graphSvg = d3.select("#graph-svg");
    const zoomGroup = graphSvg.select(".zoom-group");
    const width = document.getElementById("graph-container").clientWidth;
    const height = document.getElementById("graph-container").clientHeight;

    // Find connected nodes
    const connectedNodes = [factionData];
    linkSelection.each(function (d) {
        const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
        const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;

        if (sourceId === factionData.id) {
            const targetNode = allNodes.find(n => n.id === targetId);
            if (targetNode) connectedNodes.push(targetNode);
        } else if (targetId === factionData.id) {
            const sourceNode = allNodes.find(n => n.id === sourceId);
            if (sourceNode) connectedNodes.push(sourceNode);
        }
    });

    // Calculate bounding box
    if (connectedNodes.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        connectedNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        });

        // Add padding
        const padding = 100;
        const boxWidth = maxX - minX + padding * 2;
        const boxHeight = maxY - minY + padding * 2;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Calculate scale to fit the bounding box
        const scale = Math.min(3, 0.8 / Math.max(boxWidth / width, boxHeight / height));

        // Calculate translation to center the group
        const translateX = width / 2 - scale * centerX;
        const translateY = height / 2 - scale * centerY;

        // Apply zoom transform with animation
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => zoomGroup.attr("transform", event.transform));

        graphSvg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
    }
}


// ============================================================================
// RELATIONSHIP TYPE FILTERING
// ============================================================================

function applyRelationshipFilter(filterType) {
    graphFilterState.relationshipType = filterType;

    const graphSvg = d3.select("#graph-svg");
    const links = graphSvg.selectAll("path");
    const nodes = graphSvg.selectAll(".graph-node");
    const labels = graphSvg.selectAll(".graph-node-label");

    // First, determine which nodes have visible connections
    const visibleLinkNodes = new Set();

    links.each(function (d) {
        let isVisible = false;

        if (filterType === 'all') {
            isVisible = true;
        } else if (filterType === 'allies') {
            isVisible = d.type === 'ally';
        } else if (filterType === 'opponents') {
            isVisible = d.type === 'enemy';
        }

        // If link is visible, mark its nodes as having connections
        if (isVisible) {
            const sourceId = (d.source && typeof d.source === 'object') ? d.source.id : d.source;
            const targetId = (d.target && typeof d.target === 'object') ? d.target.id : d.target;
            if (sourceId) visibleLinkNodes.add(sourceId);
            if (targetId) visibleLinkNodes.add(targetId);
        }
    });

    // Hide/show links - use display for performance (no redraw)
    links.style("display", function (d) {
        if (filterType === 'all') return "block";
        if (filterType === 'allies') return d.type === 'ally' ? "block" : "none";
        if (filterType === 'opponents') return d.type === 'enemy' ? "block" : "none";
        return "block";
    });

    // Hide nodes that don't have any visible connections
    nodes.style("display", d => {
        if (filterType === 'all') return "block";
        return visibleLinkNodes.has(d.id) ? "block" : "none";
    });

    // Hide labels for hidden nodes
    labels.style("display", d => {
        if (filterType === 'all') return "block";
        return visibleLinkNodes.has(d.id) ? "block" : "none";
    });

    // Update filter buttons
    d3.selectAll("#relationship-type-filter .legend-item")
        .classed("active", false)
        .classed("selected", false);

    if (filterType === 'all') {
        d3.select("#filter-all-relationships").classed("active", true).classed("selected", true);
    } else if (filterType === 'allies') {
        d3.select("#filter-allies-only").classed("active", true).classed("selected", true);
    } else if (filterType === 'opponents') {
        d3.select("#filter-opponents-only").classed("active", true).classed("selected", true);
    }
}

function setupGraphFilters() {
    // Setup relationship type filter click handlers
    d3.select("#filter-all-relationships").on("click", () => applyRelationshipFilter('all'));
    d3.select("#filter-allies-only").on("click", () => applyRelationshipFilter('allies'));
    d3.select("#filter-opponents-only").on("click", () => applyRelationshipFilter('opponents'));

    // Show relationship filter section
    d3.select("#relationship-filter-section").style("display", "block");
}

// ============================================================================
// FACTION VIEW: COUNTRY CLICK ON MAP (works like clicking country bubble)
// ============================================================================

function handleFactionCountryClick(event, d) {
    const mapCountryName = d.properties.name;

    // Reverse mapping to get CSV country name
    const reverseMapping = {
        "Dem. Rep. Congo": "DR Congo (Zaire)",
        "S. Sudan": "South Sudan",
        "Central African Rep.": "Central African Republic",
        "Eq. Guinea": "Equatorial Guinea",
        "eSwatini": "Kingdom of eSwatini (Swaziland)",
        "Côte d'Ivoire": "Ivory Coast",
        "Lao PDR": "Laos",
        "Bosnia and Herz.": "Bosnia-Herzegovina",
    };

    const csvCountryName = reverseMapping[mapCountryName] || mapCountryName;

    // Check if this country has faction events
    const factionEvents = viewState.selectedFactionData || [];
    const countryEvents = factionEvents.filter(e => e.country === csvCountryName);

    if (countryEvents.length === 0) {

        return;
    }

    // Store selected country
    viewState.selectedCountryInFaction = csvCountryName;

    // Zoom to this country
    const countryFeature = findCountryFeature(csvCountryName);
    if (countryFeature) {
        zoomToCountryForFaction(countryFeature);
        setTimeout(() => {
            // Clear ALL bubbles
            bubblesGroup.selectAll("*").remove();

            // Draw individual event bubbles for this country
            drawFactionEventBubbles(countryEvents, 'country');

            // Update left panel
            const graphSvg = d3.select("#graph-svg");
            const allNodes = graphSvg.selectAll(".graph-node").data();
            const links = graphSvg.selectAll("path").data();
            displayFactionInfo({
                id: viewState.selectedFactionName,
                region: countryEvents[0]?.region,
                country: csvCountryName,
                selectedCountry: csvCountryName
            }, allNodes, links);

            // Update charts
            displayFactionCharts({
                id: viewState.selectedFactionName,
                selectedCountry: csvCountryName
            }, countryEvents);
        }, 600);
    }
}

// ============================================================================
// FACTION VIEW: EVENT SELECTION (shows details in right panel like global.js)
// ============================================================================

let lastFactionEventSelectTime = 0;

function selectFactionEvent(event) {
    // Debounce: Ignore rapid clicks (within 50ms)
    const now = performance.now();
    if (now - lastFactionEventSelectTime < 50) {
        return;
    }
    lastFactionEventSelectTime = now;

    // Early exit if same event is already selected
    if (viewState.selectedEvent === event) {
        return;
    }

    viewState.selectedEvent = event;

    // Use requestAnimationFrame for visual updates
    requestAnimationFrame(() => {
        const bubbles = bubblesGroup.selectAll(".event-bubble");

        // Remove all previous selection classes
        bubbles.classed("selected-event", false)
            .classed("unselected-event", false);

        // Add selection class only to selected bubble
        bubbles.filter(d => d === event)
            .classed("selected-event", true);

        // Batch update non-selected bubbles - make them gray
        bubbles.filter(d => d !== event)
            .classed("unselected-event", true);
    });

    // Render event details
    requestAnimationFrame(() => {
        renderFactionEventDetails(event);
    });
}

// Render event details in right panel (matching global.js format exactly)
function renderFactionEventDetails(event) {
    if (!event) return;

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

    // Build HTML string matching global.js format exactly
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
                <div style="height: 100%; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); width: ${(event.deaths_a / event.best * 100)}%;" title="Country Forces: ${d3.format(",d")(event.deaths_a)} (${d3.format(".1%")(event.deaths_a / event.best)})">
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="height: 100%; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); width: ${(event.deaths_b / event.best * 100)}%;" title="Opponent Forces: ${d3.format(",d")(event.deaths_b)} (${d3.format(".1%")(event.deaths_b / event.best)})">
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
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">Side A: ${event.side_a || 'Unknown'}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_a)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_a / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_b > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">Side B: ${event.side_b || 'Unknown'}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_b)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_b / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_civilians > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #dc2626;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">Civilian Casualties</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #dc2626; font-size: 0.9rem;">${d3.format(",d")(event.deaths_civilians)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_civilians / event.best)}</div>
                    </div>
                </div>
                ` : ''}
                ${event.deaths_unknown > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid #78716c;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: linear-gradient(135deg, #57534e 0%, #78716c 100%); border-radius: 2px;"></div>
                        <span style="color: #475569; font-size: 0.85rem; font-weight: 500;">Unknown Affiliation</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${d3.format(",d")(event.deaths_unknown)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${d3.format(".1%")(event.deaths_unknown / event.best)}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${event.source_headline || event.source_article ? `
        <div style="padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.1);">
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

// Export for global access
// graphViewActive is now declared at the top of the file
