/**
 * Statistics View - Fixed Layout and Colors
 * 
 * Data based on UCDP GED Codebook v25.1:
 * - type_of_violence: 1=State-based, 2=Non-state, 3=One-sided
 * - best: Best estimate of fatalities (deaths_a + deaths_b + deaths_civilians + deaths_unknown)
 * - low/high: Uncertainty range for fatality estimates
 * - region: Africa, Americas, Asia, Europe, Middle East
 */
// ============================================================
// UNIFIED COLOR PALETTE
// Single-hue blue with saturation/luminance variations
// ============================================================
const COLORS = {
    // Perceptually uniform sequential scale (Viridis-inspired)
    sequential: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],

    // Primary sequential scale (for heatmaps - single hue with luminance variation)
    blue: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a'
    },

    // Accent color (warm - used sparingly for highlights)
    accent: '#e63946',
    accentLight: '#fca5a5',

    // Neutral grays
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827'
    },

    // Region colors - categorical, distinguishable (Unified Warm Palette)
    regions: {
        'Africa': '#e74c3c',      // Red
        'Americas': '#9b59b6',    // Purple
        'Asia': '#f39c12',        // Orange-Yellow
        'Europe': '#3498db',      // Blue
        'Middle East': '#1abc9c'  // Teal
    },

    // Violence type colors - distinct categories
    violenceTypes: {
        1: '#1f77b4',  // State-based - Blue
        2: '#ff7f0e',  // Non-state - Orange
        3: '#d62728'   // One-sided - Red
    }
};
// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    regions: ['Africa', 'Americas', 'Asia', 'Europe', 'Middle East'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    yearStart: 1989,
    yearEnd: 2023,
    // Years for X-axis ticks (every 5 years)
    yearTicks: [1990, 1995, 2000, 2005, 2010, 2015, 2020]
};
// Global data - loaded from pre-processed JSON files
let preloadedData = {};
let tooltip = null;
// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading pre-processed statistics data...');
    tooltip = d3.select('#tooltip');

    try {
        // Load all pre-processed data files in parallel
        const [
            timelineAreaData,
            lollipopCountries,
            parallelRegions,
            violenceWaffle,
            ridgelineData,
            divergingViolence,
            treemapData,
            heatmapMonthly,
            bulletRegions,
            dotErrorBars,
            waffle2D
        ] = await Promise.all([
            d3.json('../data/timeline_area_data.json'),
            d3.json('../data/lollipop_countries.json'),
            d3.json('../data/parallel_regions.json'),
            d3.json('../data/violence_waffle.json'),
            d3.json('../data/ridgeline_data.json'),
            d3.json('../data/diverging_violence.json'),
            d3.json('../data/treemap_data.json'),
            d3.json('../data/heatmap_monthly.json'),
            d3.json('../data/bullet_regions.json'),
            d3.json('../data/dot_error_bars.json'),
            d3.json('../data/waffle_2d.json')
        ]);

        // Store all loaded data
        preloadedData = {
            timelineArea: timelineAreaData,
            lollipopCountries,
            parallelRegions,
            violenceWaffle,
            ridgeline: ridgelineData,
            divergingViolence,
            treemap: treemapData,
            heatmapMonthly,
            bulletRegions,
            dotErrorBars,
            waffle2D
        };

        console.log('All data loaded successfully');

        // Render all charts using pre-loaded data
        renderTimelineArea();
        renderSlopeRegions();
        renderWaffleViolence();
        renderRidgeline();
        renderDivergingViolence();
        renderTreemap();
        renderHeatmapMonthly();
        renderBulletRegions();
        renderDotErrorBars();
        render2DWaffleChart();

    } catch (error) {
        console.error('Error loading data:', error);
    }
});
// ============================================================
// TOOLTIP HELPERS
// ============================================================
function showTooltip(event, content) {
    tooltip.html(content)
        .style('opacity', 1)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
}
function hideTooltip() {
    tooltip.style('opacity', 0);
}
// ============================================================
// HELPER: Format numbers with K/M suffix
// ============================================================
function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
}
// ============================================================
// 1. TIMELINE AREA CHART with Uncertainty Band + Region Filters
// ============================================================
let timelineActiveRegion = 'All';

function renderTimelineArea(regionFilter = 'All') {
    const container = d3.select('#timeline-area');
    container.html('');
    timelineActiveRegion = regionFilter;

    // Create filter buttons container
    const filterContainer = container.append('div')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('gap', '8px')
        .style('margin-bottom', '12px')
        .style('flex-wrap', 'wrap');

    // Add 'All' button and each region button
    const allRegions = ['All', ...CONFIG.regions];
    allRegions.forEach(region => {
        const isActive = region === regionFilter;
        const color = region === 'All' ? COLORS.gray[600] : COLORS.regions[region];

        filterContainer.append('button')
            .style('padding', '4px 12px')
            .style('border-radius', '16px')
            .style('border', `2px solid ${color}`)
            .style('background', isActive ? color : 'transparent')
            .style('color', isActive ? 'white' : color)
            .style('font-size', '11px')
            .style('font-weight', '500')
            .style('cursor', 'pointer')
            .style('transition', 'all 0.2s')
            .text(region)
            .on('click', () => renderTimelineArea(region))
            .on('mouseover', function () {
                if (!isActive) d3.select(this).style('background', color + '20');
            })
            .on('mouseout', function () {
                if (!isActive) d3.select(this).style('background', 'transparent');
            });
    });

    // Get data from preloaded JSON
    const data = preloadedData.timelineArea;
    const yearData = data.data[regionFilter] || data.data['All'];

    const width = 900, height = 320;
    const margin = { top: 20, right: 70, bottom: 50, left: 70 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear().domain([CONFIG.yearStart, CONFIG.yearEnd]).range([0, chartW]);
    const y = d3.scaleLinear().domain([0, d3.max(yearData, d => d.events) * 1.1]).nice().range([chartH, 0]);
    const y2 = d3.scaleLinear().domain([0, d3.max(yearData, d => d.high) * 1.1]).nice().range([chartH, 0]);

    // Use region color if filtered, else blue
    const lineColor = regionFilter === 'All' ? COLORS.blue[600] : COLORS.regions[regionFilter];
    const areaColor = regionFilter === 'All' ? COLORS.blue[200] : COLORS.regions[regionFilter];

    // Uncertainty area (low-high range for casualties)
    const areaUncertainty = d3.area()
        .x(d => x(d.year))
        .y0(d => y2(d.low))
        .y1(d => y2(d.high))
        .curve(d3.curveMonotoneX);

    g.append('path')
        .datum(yearData)
        .attr('fill', areaColor)
        .attr('opacity', 0.3)
        .attr('d', areaUncertainty);

    // Events line
    const lineEvents = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.events))
        .curve(d3.curveMonotoneX);

    g.append('path')
        .datum(yearData)
        .attr('fill', 'none')
        .attr('stroke', lineColor)
        .attr('stroke-width', 2.5)
        .attr('d', lineEvents);

    // Casualties line (dashed accent)
    const lineCasualties = d3.line()
        .x(d => x(d.year))
        .y(d => y2(d.casualties))
        .curve(d3.curveMonotoneX);

    g.append('path')
        .datum(yearData)
        .attr('fill', 'none')
        .attr('stroke', COLORS.accent)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,3')
        .attr('d', lineCasualties);

    // X Axis - 5 year intervals
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x)
            .tickValues(CONFIG.yearTicks)
            .tickFormat(d3.format('d')));

    // Y Axis left (Events)
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(6).tickFormat(formatNumber));

    // Y Axis right (Casualties)
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(${chartW},0)`)
        .call(d3.axisRight(y2).ticks(6).tickFormat(formatNumber));

    // Labels
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', chartW / 2)
        .attr('y', chartH + 40)
        .attr('text-anchor', 'middle')
        .text('Year');

    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartH / 2)
        .attr('y', -50)
        .attr('text-anchor', 'middle')
        .style('fill', lineColor)
        .text('Events');

    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(90)')
        .attr('x', chartH / 2)
        .attr('y', -chartW - 55)
        .attr('text-anchor', 'middle')
        .style('fill', COLORS.accent)
        .text('Casualties');

    // Interactive dots
    g.selectAll('.dot')
        .data(yearData)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.year))
        .attr('cy', d => y(d.events))
        .attr('r', 4)
        .attr('fill', lineColor)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
            showTooltip(event, `
                <strong>${d.year}${regionFilter !== 'All' ? ` (${regionFilter})` : ''}</strong><br/>
                Events: ${d.events.toLocaleString()}<br/>
                Casualties: ${d.casualties.toLocaleString()}<br/>
                <small>Range: ${d.low.toLocaleString()} – ${d.high.toLocaleString()}</small>
            `);
        })
        .on('mouseout', hideTooltip);

    // Legend
    const legend = g.append('g').attr('transform', `translate(${chartW - 180}, 10)`);
    legend.append('line').attr('x1', 0).attr('x2', 30).attr('y1', 0).attr('y2', 0)
        .attr('stroke', lineColor).attr('stroke-width', 2.5);
    legend.append('text').attr('x', 35).attr('y', 4).style('font-size', '11px').text('Events');

    legend.append('line').attr('x1', 0).attr('x2', 30).attr('y1', 18).attr('y2', 18)
        .attr('stroke', COLORS.accent).attr('stroke-width', 2).attr('stroke-dasharray', '6,3');
    legend.append('text').attr('x', 35).attr('y', 22).style('font-size', '11px').text('Casualties');
}
// ============================================================
// 2. LOLLIPOP CHART - Top Countries
// ============================================================
function renderLollipopCountries() {
    const container = d3.select('#lollipop-countries');
    container.html('');

    // Get data from preloaded JSON
    const countryData = preloadedData.lollipopCountries;

    const width = 500, height = 380;
    const margin = { top: 10, right: 40, bottom: 40, left: 130 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([0, d3.max(countryData, d => d.events)]).nice().range([0, chartW]);
    const y = d3.scaleBand().domain(countryData.map(d => d.country)).range([0, chartH]).padding(0.35);
    const r = d3.scaleSqrt().domain([0, d3.max(countryData, d => d.avgCasualties)]).range([4, 14]);

    // Lines
    g.selectAll('.lollipop-line')
        .data(countryData)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', d => x(d.events))
        .attr('y1', d => y(d.country) + y.bandwidth() / 2)
        .attr('y2', d => y(d.country) + y.bandwidth() / 2)
        .attr('stroke', COLORS.blue[300])
        .attr('stroke-width', 2);

    // Circles
    g.selectAll('.lollipop-circle')
        .data(countryData)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.events))
        .attr('cy', d => y(d.country) + y.bandwidth() / 2)
        .attr('r', d => r(d.avgCasualties))
        .attr('fill', COLORS.blue[500])
        .attr('stroke', COLORS.blue[700])
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
            showTooltip(event, `
                <strong>${d.country}</strong><br/>
                Events: ${d.events.toLocaleString()}<br/>
                Total Casualties: ${d.casualties.toLocaleString()}<br/>
                Avg/Event: ${d.avgCasualties.toFixed(1)}
            `);
        })
        .on('mouseout', hideTooltip);

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(formatNumber));

    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y));

    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', chartW / 2)
        .attr('y', chartH + 35)
        .attr('text-anchor', 'middle')
        .text('Number of Events');
}
// ============================================================
// 3. PARALLEL COORDINATES - Regional Changes Over Time Periods
// ============================================================
function renderSlopeRegions() {
    const container = d3.select('#slope-regions');
    container.html('');

    // Get data from preloaded JSON
    const data = preloadedData.parallelRegions;
    const periods = data.periods.map(label => ({ label }));
    const parallelData = data.data;

    const width = 480, height = 340;
    const margin = { top: 40, right: 30, bottom: 60, left: 50 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // X scale for periods
    const x = d3.scalePoint()
        .domain(periods.map(p => p.label))
        .range([0, chartW])
        .padding(0.1);

    // Y scale for values
    const maxVal = d3.max(parallelData, d => d3.max(d.values));
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).nice().range([chartH, 0]);

    // Draw vertical axes for each period
    periods.forEach((period, i) => {
        g.append('line')
            .attr('x1', x(period.label))
            .attr('x2', x(period.label))
            .attr('y1', 0)
            .attr('y2', chartH)
            .attr('stroke', COLORS.gray[200])
            .attr('stroke-width', 1);
    });

    // Draw lines for each region
    const line = d3.line()
        .x((d, i) => x(periods[i].label))
        .y(d => y(d))
        .curve(d3.curveMonotoneX);

    parallelData.forEach(region => {
        // Path
        g.append('path')
            .datum(region.values)
            .attr('fill', 'none')
            .attr('stroke', region.color)
            .attr('stroke-width', 2.5)
            .attr('opacity', 0.8)
            .attr('d', line);

        // Dots at each period
        region.values.forEach((val, i) => {
            g.append('circle')
                .attr('cx', x(periods[i].label))
                .attr('cy', y(val))
                .attr('r', 4)
                .attr('fill', region.color)
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    showTooltip(event, `<strong>${region.region}</strong><br/>${periods[i].label}: ${val} events/year`);
                })
                .on('mouseout', hideTooltip);
        });
    });

    // X Axis (period labels)
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('font-size', '10px');

    // Y Axis
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5).tickFormat(formatNumber));

    // Y Axis label
    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartH / 2)
        .attr('y', -35)
        .attr('text-anchor', 'middle')
        .text('Avg Events/Year');

    // Legend at bottom
    const legend = g.append('g').attr('transform', `translate(0, ${chartH + 30})`);
    const legendItemWidth = chartW / CONFIG.regions.length;

    CONFIG.regions.forEach((region, i) => {
        const lg = legend.append('g').attr('transform', `translate(${i * legendItemWidth}, 0)`);
        lg.append('circle')
            .attr('cx', 5)
            .attr('cy', 0)
            .attr('r', 4)
            .attr('fill', COLORS.regions[region]);
        lg.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .style('font-size', '9px')
            .style('fill', COLORS.gray[600])
            .text(region.length > 8 ? region.slice(0, 7) + '…' : region);
    });
}
// ============================================================
// WAFFLE CHART - Violence Types (from waffle_data.json)
// ============================================================
function renderWaffleViolence() {
    const container = d3.select('#waffle-violence');
    container.html('');

    // Get data from preloaded JSON
    const waffleData = preloadedData.violenceWaffle;

    const width = 380, height = 340;
    const margin = { top: 20, right: 100, bottom: 40, left: 20 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Waffle grid settings
    const gridSize = 10; // 10x10 = 100 squares
    const squareSize = 22;
    const squareGap = 3;

    // Build waffle squares based on percentage
    const squares = [];
    let squareIndex = 0;

    waffleData.forEach(item => {
        const count = Math.round(item.percentage);
        for (let i = 0; i < count && squareIndex < 100; i++) {
            squares.push({
                index: squareIndex,
                type: item.type,
                name: item.name,
                color: COLORS.violenceTypes[item.type] || item.color,
                percentage: item.percentage,
                count: item.count,
                casualties: item.casualties
            });
            squareIndex++;
        }
    });

    // Fill remaining with gray if any
    while (squares.length < 100) {
        squares.push({ index: squares.length, color: COLORS.gray[200], name: 'Other' });
    }

    // Draw waffle squares
    g.selectAll('.waffle-square')
        .data(squares)
        .enter()
        .append('rect')
        .attr('class', 'waffle-square')
        .attr('x', d => (d.index % gridSize) * (squareSize + squareGap))
        .attr('y', d => Math.floor(d.index / gridSize) * (squareSize + squareGap))
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('fill', d => d.color)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
            if (d.count) {
                showTooltip(event, `
                        <strong>${d.name}</strong><br/>
                        Events: ${d.count.toLocaleString()}<br/>
                        Percentage: ${d.percentage.toFixed(1)}%<br/>
                        Casualties: ${d.casualties.toLocaleString()}
                    `);
            }
        })
        .on('mouseout', hideTooltip);

    // Legend
    const legendX = gridSize * (squareSize + squareGap) + 15;
    const legendG = g.append('g').attr('transform', `translate(${legendX}, 10)`);

    legendG.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('fill', COLORS.gray[700])
        .text('Violence Type');

    waffleData.forEach((item, i) => {
        const ly = 20 + i * 28;
        legendG.append('rect')
            .attr('x', 0)
            .attr('y', ly)
            .attr('width', 16)
            .attr('height', 16)
            .attr('fill', COLORS.violenceTypes[item.type] || item.color)
            .attr('rx', 2);
        legendG.append('text')
            .attr('x', 22)
            .attr('y', ly + 12)
            .style('font-size', '9px')
            .style('fill', COLORS.gray[600])
            .text(`${item.name.split(' ')[0]} (${item.percentage.toFixed(0)}%)`);
    });
}
// ============================================================
// 4. RIDGELINE PLOT - Events per Year Distribution by Region
// ============================================================
function renderRidgeline() {
    const container = d3.select('#ridgeline-casualties');
    container.html('');

    const width = 850, height = 320;
    const margin = { top: 20, right: 30, bottom: 50, left: 90 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const overlap = 0.7;
    const rowHeight = chartH / CONFIG.regions.length;

    // X scale: years
    const x = d3.scaleLinear().domain([CONFIG.yearStart, CONFIG.yearEnd]).range([0, chartW]);

    // Get data from preloaded JSON
    const ridgeData = preloadedData.ridgeline;

    ridgeData.data.forEach((regionData, i) => {
        const region = regionData.region;
        const yearCounts = regionData.yearCounts;
        const maxCount = regionData.maxCount || 1;

        const yDensity = d3.scaleLinear()
            .domain([0, maxCount])
            .range([0, rowHeight * (1 + overlap)]);

        const yPos = i * rowHeight;

        // Create area generator
        const area = d3.area()
            .x(d => x(d.year))
            .y0(yPos + rowHeight)
            .y1(d => yPos + rowHeight - yDensity(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(yearCounts)
            .attr('fill', COLORS.regions[region])
            .attr('fill-opacity', 0.6)
            .attr('stroke', COLORS.regions[region])
            .attr('stroke-width', 1.5)
            .attr('d', area);

        // Direct label on the ridge
        g.append('text')
            .attr('x', -10)
            .attr('y', yPos + rowHeight - 8)
            .attr('text-anchor', 'end')
            .style('font-size', '11px')
            .style('font-weight', '500')
            .style('fill', COLORS.regions[region])
            .text(region);
    });

    // X axis - years
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x)
            .tickValues(CONFIG.yearTicks)
            .tickFormat(d3.format('d')));

    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', chartW / 2)
        .attr('y', chartH + 40)
        .attr('text-anchor', 'middle')
        .text('Year');
}
// ============================================================
// 5. DIVERGING BAR CHART - Violence Types by Region
// ============================================================
function renderDivergingViolence() {
    const container = d3.select('#diverging-violence');
    container.html('');

    // Get data from preloaded JSON and transform for chart
    const data = preloadedData.divergingViolence.map(d => ({
        region: d.region,
        stateBased: -d.stateBased,
        oneSided: d.oneSided
    }));

    const width = 480, height = 320;
    const margin = { top: 50, right: 30, bottom: 40, left: 90 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const maxVal = d3.max(data, d => Math.max(Math.abs(d.stateBased), d.oneSided));
    const x = d3.scaleLinear().domain([-maxVal * 1.1, maxVal * 1.1]).range([0, chartW]);
    const y = d3.scaleBand().domain(data.map(d => d.region)).range([0, chartH]).padding(0.35);

    // State-based bars (left, blue)
    g.selectAll('.bar-left')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.stateBased))
        .attr('y', d => y(d.region))
        .attr('width', d => x(0) - x(d.stateBased))
        .attr('height', y.bandwidth())
        .attr('fill', COLORS.blue[600])
        .attr('rx', 2)
        .on('mouseover', (event, d) => {
            showTooltip(event, `<strong>${d.region}</strong><br/>State-based: ${Math.abs(d.stateBased).toLocaleString()}`);
        })
        .on('mouseout', hideTooltip);

    // One-sided bars (right, orange)
    g.selectAll('.bar-right')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', x(0))
        .attr('y', d => y(d.region))
        .attr('width', d => x(d.oneSided) - x(0))
        .attr('height', y.bandwidth())
        .attr('fill', COLORS.accent)
        .attr('rx', 2)
        .on('mouseover', (event, d) => {
            showTooltip(event, `<strong>${d.region}</strong><br/>One-sided: ${d.oneSided.toLocaleString()}`);
        })
        .on('mouseout', hideTooltip);

    // Center line
    g.append('line')
        .attr('x1', x(0)).attr('x2', x(0))
        .attr('y1', -10).attr('y2', chartH)
        .attr('stroke', COLORS.gray[400]).attr('stroke-width', 1);

    // Axes
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y));
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d => formatNumber(Math.abs(d))));

    // Labels for diverging
    g.append('text')
        .attr('x', x(-maxVal * 0.6))
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '500')
        .style('fill', COLORS.blue[700])
        .text('← State-based');

    g.append('text')
        .attr('x', x(maxVal * 0.6))
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '500')
        .style('fill', COLORS.accent)
        .text('One-sided →');
}
// ============================================================
// 6. TREEMAP - Casualties by Country
// ============================================================
function renderTreemap() {
    const container = d3.select('#treemap-casualties');
    container.html('');

    // Get data from preloaded JSON
    const countryData = preloadedData.treemap;

    const width = 480, height = 320;

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const root = d3.hierarchy({ children: countryData }).sum(d => d.value);
    d3.treemap().size([width, height]).padding(2).round(true)(root);

    const cells = svg.selectAll('.cell')
        .data(root.leaves())
        .enter()
        .append('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    cells.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => COLORS.regions[d.data.region] || COLORS.blue[400])
        .attr('opacity', 0.85)
        .attr('rx', 3)
        .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke', COLORS.gray[800]).attr('stroke-width', 2);
            showTooltip(event, `<strong>${d.data.name}</strong><br/>Casualties: ${d.data.value.toLocaleString()}<br/>Region: ${d.data.region}`);
        })
        .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.85).attr('stroke', 'none');
            hideTooltip();
        });

    cells.filter(d => (d.x1 - d.x0) > 55 && (d.y1 - d.y0) > 25)
        .append('text')
        .attr('x', 5).attr('y', 16)
        .style('font-size', '10px')
        .style('fill', 'white')
        .style('font-weight', '600')
        .style('pointer-events', 'none')
        .text(d => d.data.name.length > 12 ? d.data.name.slice(0, 10) + '…' : d.data.name);
}
// ============================================================
// 7. HEATMAP - Monthly Patterns + Region Filters
// ============================================================
let heatmapActiveRegion = 'All';

function renderHeatmapMonthly(regionFilter = 'All') {
    const container = d3.select('#heatmap-monthly');
    container.html('');
    heatmapActiveRegion = regionFilter;

    // Create filter buttons container
    const filterContainer = container.append('div')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('gap', '8px')
        .style('margin-bottom', '12px')
        .style('flex-wrap', 'wrap');

    // Add 'All' button and each region button
    const allRegions = ['All', ...CONFIG.regions];
    allRegions.forEach(region => {
        const isActive = region === regionFilter;
        const color = region === 'All' ? COLORS.gray[600] : COLORS.regions[region];

        filterContainer.append('button')
            .style('padding', '4px 12px')
            .style('border-radius', '16px')
            .style('border', `2px solid ${color}`)
            .style('background', isActive ? color : 'transparent')
            .style('color', isActive ? 'white' : color)
            .style('font-size', '11px')
            .style('font-weight', '500')
            .style('cursor', 'pointer')
            .style('transition', 'all 0.2s')
            .text(region)
            .on('click', () => renderHeatmapMonthly(region))
            .on('mouseover', function () {
                if (!isActive) d3.select(this).style('background', color + '20');
            })
            .on('mouseout', function () {
                if (!isActive) d3.select(this).style('background', 'transparent');
            });
    });

    // Get data from preloaded JSON
    const heatmapData = preloadedData.heatmapMonthly;
    const heatData = heatmapData.data[regionFilter] || heatmapData.data['All'];
    const years = heatmapData.years;

    const width = 850, height = 280;
    const margin = { top: 30, right: 70, bottom: 30, left: 50 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const x = d3.scaleBand().domain(years).range([0, chartW]).padding(0.03);
    const y = d3.scaleBand().domain(CONFIG.months).range([0, chartH]).padding(0.03);

    const maxCount = d3.max(heatData, d => d.count) || 1;

    // Use Viridis-inspired interpolator for perceptual uniformity
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxCount]);

    g.selectAll('.heatmap-cell')
        .data(heatData)
        .enter()
        .append('rect')
        .attr('x', d => x(d.year))
        .attr('y', d => y(d.monthName))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('fill', d => d.count > 0 ? colorScale(d.count) : COLORS.gray[100])
        .attr('rx', 1)
        .on('mouseover', (event, d) => {
            showTooltip(event, `<strong>${d.monthName} ${d.year}${regionFilter !== 'All' ? ` (${regionFilter})` : ''}</strong><br/>Events: ${d.count.toLocaleString()}`);
        })
        .on('mouseout', hideTooltip);

    // X Axis - every 5 years
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisTop(x).tickValues(CONFIG.yearTicks).tickFormat(d3.format('d')));

    // Y Axis
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y));

    // Color legend with multiple stops for Viridis gradient
    const gradientId = 'heatmap-grad-' + regionFilter.replace(/\s/g, '');
    const legendW = 14, legendH = chartH - 20;
    const legendScale = d3.scaleLinear().domain([0, maxCount]).range([legendH, 0]);

    const legendGroup = g.append('g').attr('transform', `translate(${chartW + 15}, 10)`);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%').attr('y1', '100%')
        .attr('x2', '0%').attr('y2', '0%');

    // Add multiple color stops for full Viridis spectrum
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
        const t = i / numStops;
        gradient.append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', d3.interpolateViridis(t));
    }

    legendGroup.append('rect')
        .attr('width', legendW)
        .attr('height', legendH)
        .style('fill', `url(#${gradientId})`)
        .attr('rx', 2);

    legendGroup.append('g')
        .attr('transform', `translate(${legendW + 2}, 0)`)
        .call(d3.axisRight(legendScale).ticks(4).tickFormat(formatNumber));
}
// ============================================================
// 8. BULLET CHART - Regional Metrics
// ============================================================
function renderBulletRegions() {
    const container = d3.select('#bullet-regions');
    container.html('');

    // Get data from preloaded JSON
    const data = preloadedData.bulletRegions;

    const width = 480, height = 320;
    const margin = { top: 20, right: 40, bottom: 40, left: 90 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const maxVal = d3.max(data, d => Math.max(d.recent, d.avg, d.trend));
    const x = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([0, chartW]);
    const y = d3.scaleBand().domain(data.map(d => d.region)).range([0, chartH]).padding(0.3);

    data.forEach(d => {
        const yPos = y(d.region);
        const h = y.bandwidth();

        // Background range
        g.append('rect')
            .attr('x', 0).attr('y', yPos)
            .attr('width', chartW).attr('height', h)
            .attr('fill', COLORS.gray[100])
            .attr('rx', 3);

        // Historical average bar
        g.append('rect')
            .attr('x', 0).attr('y', yPos)
            .attr('width', x(d.avg)).attr('height', h)
            .attr('fill', COLORS.gray[300])
            .attr('rx', 3);

        // Current (2023) bar
        g.append('rect')
            .attr('x', 0).attr('y', yPos + h * 0.2)
            .attr('width', x(d.recent)).attr('height', h * 0.6)
            .attr('fill', d.color)
            .attr('rx', 2);

        // Trend marker (5-year avg)
        g.append('line')
            .attr('x1', x(d.trend)).attr('x2', x(d.trend))
            .attr('y1', yPos + 2).attr('y2', yPos + h - 2)
            .attr('stroke', COLORS.accent)
            .attr('stroke-width', 3);
    });

    // Axes
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y));
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(formatNumber));

    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', chartW / 2)
        .attr('y', chartH + 35)
        .attr('text-anchor', 'middle')
        .text('Events per Year');

    // Legend
    const legend = g.append('g').attr('transform', `translate(0, ${chartH + 10})`);
    // (Keep it simple - no additional legend needed, context is in description)
}
// ============================================================
// 9. DOT PLOT with ERROR BARS - Average Casualties with 95% CI
// ============================================================
function renderDotErrorBars() {
    const container = d3.select('#dot-error-bars');
    container.html('');

    // Get data from preloaded JSON
    const data = preloadedData.dotErrorBars;

    const width = 480, height = 320;
    const margin = { top: 20, right: 30, bottom: 50, left: 90 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const maxVal = d3.max(data, d => d.high);
    const x = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([0, chartW]);
    const y = d3.scaleBand().domain(data.map(d => d.region)).range([0, chartH]).padding(0.5);

    // Error bars and mean dots
    data.forEach(d => {
        const yPos = y(d.region) + y.bandwidth() / 2;

        // Horizontal CI line
        g.append('line')
            .attr('x1', x(d.low)).attr('x2', x(d.high))
            .attr('y1', yPos).attr('y2', yPos)
            .attr('stroke', d.color)
            .attr('stroke-width', 2);

        // Caps
        [d.low, d.high].forEach(val => {
            g.append('line')
                .attr('x1', x(val)).attr('x2', x(val))
                .attr('y1', yPos - 8).attr('y2', yPos + 8)
                .attr('stroke', d.color)
                .attr('stroke-width', 2);
        });

        // Mean dot
        g.append('circle')
            .attr('cx', x(d.mean)).attr('cy', yPos)
            .attr('r', 8)
            .attr('fill', d.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', (event) => {
                showTooltip(event, `
                    <strong>${d.region}</strong><br/>
                    Mean: ${d.mean.toFixed(1)}<br/>
                    95% CI: [${d.low.toFixed(1)}, ${d.high.toFixed(1)}]<br/>
                    n = ${d.n.toLocaleString()}
                `);
            })
            .on('mouseout', hideTooltip);
    });

    // Axes
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y));
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartH})`)
        .call(d3.axisBottom(x).ticks(5));

    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', chartW / 2)
        .attr('y', chartH + 40)
        .attr('text-anchor', 'middle')
        .text('Average Casualties per Event');
}
// ============================================================
// 10. 2D HEATMAP - Time Period x Casualty Range
// ============================================================
function render2DWaffleChart() {
    const container = d3.select('#waffle-2d');
    container.html('');

    // Get data from preloaded JSON
    const waffle2DData = preloadedData.waffle2D;
    const casualtyRanges = waffle2DData.casualtyRanges.map(label => ({ label }));
    const timePeriods = waffle2DData.timePeriods.map(label => ({ label }));
    const maxEvents = waffle2DData.maxEvents;

    const cellSize = 45;
    const cellGap = 2;
    const width = 700, height = 420;
    const margin = { top: 60, right: 100, bottom: 80, left: 100 };

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const chartW = casualtyRanges.length * (cellSize + cellGap) - cellGap;
    const chartH = timePeriods.length * (cellSize + cellGap) - cellGap;

    // Transform grid data to include x, y coordinates
    const gridData = waffle2DData.gridData.map(d => ({
        ...d,
        x: d.col * (cellSize + cellGap),
        y: d.row * (cellSize + cellGap)
    }));

    // Color scale - Viridis for event density
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, maxEvents]);

    // Draw cells
    g.selectAll('.heatmap-cell')
        .data(gridData)
        .enter()
        .append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => d.count > 0 ? colorScale(d.count) : COLORS.gray[100])
        .attr('stroke', COLORS.gray[200])
        .attr('stroke-width', 1)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
            const regionBreakdown = CONFIG.regions
                .filter(r => d.regionCounts[r] > 0)
                .map(r => `${r}: ${d.regionCounts[r]}`)
                .join('<br/>');

            showTooltip(event, `
                <strong>${d.period}</strong><br/>
                Casualties: ${d.casualty}<br/>
                Events: ${d.count.toLocaleString()}<br/>
                ${regionBreakdown ? '<hr style="margin:4px 0;border-color:#555"/>' + regionBreakdown : ''}
            `);
        })
        .on('mouseout', hideTooltip);

    // X-axis labels (casualty ranges)
    g.selectAll('.x-label')
        .data(casualtyRanges)
        .enter()
        .append('text')
        .attr('x', (d, i) => i * (cellSize + cellGap) + cellSize / 2)
        .attr('y', chartH + 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', COLORS.gray[600])
        .text(d => d.label);

    // X-axis title
    g.append('text')
        .attr('x', chartW / 2)
        .attr('y', chartH + 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', COLORS.gray[700])
        .text('Casualties per Event');

    // Y-axis labels (time periods)
    g.selectAll('.y-label')
        .data(timePeriods)
        .enter()
        .append('text')
        .attr('x', -10)
        .attr('y', (d, i) => i * (cellSize + cellGap) + cellSize / 2 + 4)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('fill', COLORS.gray[600])
        .text(d => d.label);

    // Y-axis title
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartH / 2)
        .attr('y', -70)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', COLORS.gray[700])
        .text('Time Period');

    // Color legend
    const legendW = 15, legendH = chartH - 20;
    const legendScale = d3.scaleLinear().domain([0, maxEvents]).range([legendH, 0]);

    const legendGroup = g.append('g').attr('transform', `translate(${chartW + 25}, 10)`);

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'waffle-legend-grad')
        .attr('x1', '0%').attr('y1', '100%')
        .attr('x2', '0%').attr('y2', '0%');

    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        gradient.append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', d3.interpolateViridis(t));
    }

    legendGroup.append('rect')
        .attr('width', legendW)
        .attr('height', legendH)
        .style('fill', 'url(#waffle-legend-grad)')
        .attr('rx', 2);

    legendGroup.append('g')
        .attr('transform', `translate(${legendW + 3}, 0)`)
        .call(d3.axisRight(legendScale).ticks(5).tickFormat(formatNumber));

    // Legend title
    legendGroup.append('text')
        .attr('x', legendW / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', COLORS.gray[600])
        .text('Events');
}

