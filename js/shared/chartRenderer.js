// ============================================================================
// CHART RENDERER - D3 chart components for conflict visualization
// ============================================================================

const ChartRenderer = {
    /**
     * Draw timeline chart (casualties over time)
     * @param {Array} data - [{year, casualties}]
     * @param {string} svgSelector - CSS selector for SVG
     * @param {Object} options - {width, height, margin}
     */
    drawTimelineChart(data, svgSelector, options = {}) {
        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const width = options.width || parseInt(svg.style("width")) || 400;
        const height = options.height || 180;
        const margin = options.margin || { top: 20, right: 20, bottom: 30, left: 50 };

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        if (!data || data.length === 0) {
            g.append("text")
                .attr("x", innerWidth / 2)
                .attr("y", innerHeight / 2)
                .attr("text-anchor", "middle")
                .style("fill", "#94a3b8")
                .text("No data available");
            return;
        }

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year))
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.casualties)])
            .nice()
            .range([innerHeight, 0]);

        // Area
        const area = d3.area()
            .x(d => x(d.year))
            .y0(innerHeight)
            .y1(d => y(d.casualties))
            .curve(d3.curveMonotoneX);

        g.append("path")
            .datum(data)
            .attr("fill", "rgba(239, 68, 68, 0.2)")
            .attr("d", area);

        // Line
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.casualties))
            .curve(d3.curveMonotoneX);

        g.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 2)
            .attr("d", line);

        // Axes
        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(6))
            .selectAll("text")
            .style("font-size", "10px");

        g.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")))
            .selectAll("text")
            .style("font-size", "10px");
    },

    /**
     * Draw violence type chart (donut/pie)
     * @param {Array} data - [{type, casualties}]
     * @param {string} svgSelector - CSS selector for SVG
     * @param {Object} options - {width, height}
     */
    drawViolenceTypeChart(data, svgSelector, options = {}) {
        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const width = options.width || 200;
        const height = options.height || 200;
        const radius = Math.min(width, height) / 2 - 10;

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        if (!data || data.length === 0) {
            g.append("text")
                .attr("text-anchor", "middle")
                .style("fill", "#94a3b8")
                .text("No data");
            return;
        }

        const pie = d3.pie()
            .value(d => d.casualties)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(radius * 0.5)
            .outerRadius(radius);

        const arcs = g.selectAll("arc")
            .data(pie(data))
            .enter()
            .append("g");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => TYPE_COLORS[d.data.type] || "#64748b")
            .style("opacity", 0.8);

        // Labels
        arcs.append("text")
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "10px")
            .style("font-weight", "600")
            .text(d => {
                const pct = (d.endAngle - d.startAngle) / (2 * Math.PI);
                return pct > 0.1 ? d3.format(".0%")(pct) : "";
            });
    },

    /**
     * Draw year-month heatmap
     * @param {Array} data - [{year, month, casualties}]
     * @param {string} svgSelector - CSS selector for SVG
     * @param {Object} options - {width, height}
     */
    drawYearMonthHeatmap(data, svgSelector, options = {}) {
        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node().parentElement;
        const width = options.width || container.clientWidth || 300;
        const height = options.height || 150;
        const margin = { top: 20, right: 10, bottom: 30, left: 40 };

        if (!data || data.length === 0) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .style("fill", "#94a3b8")
                .text("No data");
            return;
        }

        const years = [...new Set(data.map(d => d.year))].sort();
        const months = d3.range(1, 13);
        const monthNames = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

        const cellWidth = Math.max(8, (width - margin.left - margin.right) / years.length);
        const cellHeight = Math.max(8, (height - margin.top - margin.bottom) / 12);

        const maxCasualties = d3.max(data, d => d.casualties);
        const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, maxCasualties]);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Create lookup
        const lookup = new Map();
        data.forEach(d => lookup.set(`${d.year}-${d.month}`, d.casualties));

        // Draw cells
        years.forEach((year, xi) => {
            months.forEach((month, yi) => {
                const value = lookup.get(`${year}-${month}`) || 0;
                g.append("rect")
                    .attr("x", xi * cellWidth)
                    .attr("y", yi * cellHeight)
                    .attr("width", cellWidth - 1)
                    .attr("height", cellHeight - 1)
                    .attr("fill", value > 0 ? colorScale(value) : "#f1f5f9")
                    .attr("rx", 2);
            });
        });

        // Year labels
        const yearLabels = years.filter((_, i) => i % Math.ceil(years.length / 6) === 0);
        g.selectAll(".year-label")
            .data(yearLabels)
            .enter()
            .append("text")
            .attr("x", d => years.indexOf(d) * cellWidth + cellWidth / 2)
            .attr("y", 12 * cellHeight + 12)
            .attr("text-anchor", "middle")
            .style("font-size", "9px")
            .style("fill", "#64748b")
            .text(d => d);

        // Month labels
        g.selectAll(".month-label")
            .data(monthNames)
            .enter()
            .append("text")
            .attr("x", -5)
            .attr("y", (d, i) => i * cellHeight + cellHeight / 2 + 3)
            .attr("text-anchor", "end")
            .style("font-size", "8px")
            .style("fill", "#64748b")
            .text(d => d);
    },

    /**
     * Draw connected factions bar chart
     * @param {Array} factions - [{name, casualties, color}]
     * @param {string} containerSelector - CSS selector for container
     * @param {Object} options - {onFactionClick, maxItems}
     */
    drawConnectedFactionsChart(factions, containerSelector, options = {}) {
        const container = d3.select(containerSelector);
        container.selectAll("*").remove();

        if (!factions || factions.length === 0) {
            container.append("div")
                .style("text-align", "center")
                .style("color", "#94a3b8")
                .style("padding", "1rem")
                .text("No factions found");
            return;
        }

        const maxItems = options.maxItems || 10;
        const sortedFactions = [...factions]
            .sort((a, b) => b.casualties - a.casualties)
            .slice(0, maxItems);

        const maxCasualties = d3.max(sortedFactions, d => d.casualties) || 1;

        sortedFactions.forEach(faction => {
            const row = container.append("div")
                .style("margin-bottom", "0.5rem")
                .style("cursor", options.onFactionClick ? "pointer" : "default")
                .on("click", () => {
                    if (options.onFactionClick) {
                        options.onFactionClick(faction);
                    }
                });

            row.append("div")
                .style("display", "flex")
                .style("justify-content", "space-between")
                .style("font-size", "0.75rem")
                .style("margin-bottom", "0.25rem")
                .html(`
                    <span style="color: #475569; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${faction.name}</span>
                    <span style="color: #ef4444; font-weight: 600;">${formatNumber(faction.casualties)}</span>
                `);

            const barContainer = row.append("div")
                .style("height", "6px")
                .style("background", "#e2e8f0")
                .style("border-radius", "3px")
                .style("overflow", "hidden");

            barContainer.append("div")
                .style("width", `${(faction.casualties / maxCasualties) * 100}%`)
                .style("height", "100%")
                .style("background", faction.color || "#3b82f6")
                .style("border-radius", "3px");
        });
    },

    /**
     * Render top events list
     * @param {Array} events - Event array
     * @param {string} containerSelector - CSS selector for container
     * @param {Object} options - {maxItems, onEventClick}
     */
    renderTopEventsList(events, containerSelector, options = {}) {
        const container = d3.select(containerSelector);
        container.selectAll("*").remove();

        if (!events || events.length === 0) {
            container.append("div")
                .style("text-align", "center")
                .style("color", "#94a3b8")
                .style("padding", "1rem")
                .text("No events found");
            return;
        }

        const maxItems = options.maxItems || 5;
        const topEvents = [...events]
            .sort((a, b) => b.best - a.best)
            .slice(0, maxItems);

        topEvents.forEach((event, i) => {
            const item = container.append("div")
                .attr("class", "event-item")
                .style("cursor", options.onEventClick ? "pointer" : "default")
                .on("click", () => {
                    if (options.onEventClick) {
                        options.onEventClick(event);
                    }
                });

            item.append("div")
                .attr("class", "event-item-title")
                .text(event.dyad_name || event.conflict_name || `Event ${i + 1}`);

            item.append("div")
                .attr("class", "event-item-meta")
                .html(`
                    <span>${event.date_start || event.year}</span> • 
                    <span style="color: ${TYPE_COLORS[event.type_of_violence_name] || '#64748b'}">${event.type_of_violence_name}</span> • 
                    <span style="color: #ef4444; font-weight: 600;">${formatNumber(event.best)} casualties</span>
                `);
        });
    }
};
