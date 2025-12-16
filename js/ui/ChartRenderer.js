// ============================================================================
// CHART RENDERER - Generic D3 chart components
// Entry Point Agnostic: Same charts for both Country and Faction views
// ============================================================================

const ChartRenderer = {
    // ========================================================================
    // TIMELINE CHART (Line chart with area fill)
    // ========================================================================

    /**
     * Draw timeline chart showing casualties over time
     * @param {Array} data - [{year, casualties}]
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height, margin, color}
     */
    drawTimelineChart(data, svgSelector, options = {}) {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) {
            console.warn("ChartRenderer: Timeline chart container not found");
            return;
        }

        const width = options.width || container.getBoundingClientRect().width || 300;
        const height = options.height || 180;
        const margin = options.margin || { top: 10, right: 10, bottom: 30, left: 50 };
        const color = options.color || "#3b82f6";

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        svg.attr("width", width).attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year))
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.casualties)])
            .range([innerHeight, 0]);

        // Area fill
        const area = d3.area()
            .x(d => x(d.year))
            .y0(innerHeight)
            .y1(d => y(d.casualties))
            .curve(d3.curveMonotoneX);

        g.append("path")
            .datum(data)
            .attr("fill", `${color}33`) // 20% opacity
            .attr("d", area);

        // Line
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.casualties))
            .curve(d3.curveMonotoneX);

        g.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("d", line);

        // X axis
        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")))
            .style("color", "#94a3b8")
            .style("font-size", "0.75rem");

        // Y axis
        g.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")))
            .style("color", "#94a3b8")
            .style("font-size", "0.75rem");
    },

    // ========================================================================
    // VIOLENCE TYPE CHART (Donut/Pie chart)
    // ========================================================================

    /**
     * Draw violence type breakdown chart
     * @param {Array} data - [{type, casualties}]
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height, showLegend}
     */
    drawViolenceTypeChart(data, svgSelector, options = {}) {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) return;

        const width = options.width || container.getBoundingClientRect().width || 300;
        const height = options.height || 200;
        const showLegend = options.showLegend !== false;
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
            .data(pie(data))
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
                d3.select(this)
                    .style("opacity", 1)
                    .style("stroke", "#fff")
                    .style("stroke-width", "3px");

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
                d3.select(this)
                    .style("opacity", 0.85)
                    .style("stroke", "#f8fafc")
                    .style("stroke-width", "2px");
                g.selectAll(".center-text").remove();
            });

        // Legend
        if (showLegend) {
            const legend = g.append("g")
                .attr("transform", `translate(${-width / 2 + 10}, ${-height / 2 + 10})`);

            data.forEach((d, i) => {
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
    },

    // ========================================================================
    // YEAR-MONTH HEATMAP
    // ========================================================================

    /**
     * Draw year-month heatmap for conflict intensity
     * @param {Array} data - [{year, month, casualties}]
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height}
     */
    drawYearMonthHeatmap(data, svgSelector, options = {}) {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) return;

        // Responsive sizing - use container size or minimum values
        const containerRect = container.getBoundingClientRect();
        const width = options.width || containerRect.width || 380;
        // Use container height with minimum of 280px for readability
        const minHeight = 280;
        const containerHeight = containerRect.height || 320;
        const height = Math.max(minHeight, containerHeight);
        const margin = { top: 10, right: 15, bottom: 50, left: 45 }; // Reduced margins

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        svg.attr("width", width).attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Get unique years
        const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
        // Use short month names for better fit
        const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthsFull = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        const cellWidth = innerWidth / years.length;
        const cellHeight = innerHeight / 12;

        const maxCasualties = d3.max(data, d => d.casualties) || 1;

        const colorScale = d3.scaleSequential()
            .domain([0, maxCasualties])
            .interpolator(d3.interpolateYlOrRd);

        // Draw cells
        g.selectAll("rect")
            .data(data)
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
            .text(d => `${monthsFull[d.month - 1]} ${d.year}: ${d3.format(",d")(d.casualties)} casualties`);

        // Y-axis (Months)
        const yAxis = d3.axisLeft(d3.scaleBand()
            .domain(monthsShort)
            .range([0, innerHeight]))
            .tickSize(0);

        g.append("g")
            .call(yAxis)
            .selectAll("text")
            .style("fill", "#64748b")
            .style("font-size", "0.65rem");

        // X-axis (Years)
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
            .style("font-size", "0.55rem")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        g.selectAll(".domain").remove();
    },

    // ========================================================================
    // SEASONALITY CHART (Bar chart by month)
    // ========================================================================

    /**
     * Draw seasonality chart showing conflict by month
     * @param {Array} data - [{month, monthNum, casualties}]
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height}
     */
    drawSeasonalityChart(data, svgSelector, options = {}) {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) return;

        const width = options.width || container.getBoundingClientRect().width || 300;
        const height = options.height || 180;
        const margin = { top: 10, right: 10, bottom: 30, left: 40 };

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        svg.attr("width", width).attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const months = data.map(d => d.month);

        const x = d3.scaleBand()
            .domain(months)
            .range([0, innerWidth])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.casualties)])
            .range([innerHeight, 0]);

        // Gradient
        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "seasonality-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#f59e0b");
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ef4444");

        // Bars
        g.selectAll(".bar")
            .data(data)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.month))
            .attr("y", d => y(d.casualties))
            .attr("width", x.bandwidth())
            .attr("height", d => innerHeight - y(d.casualties))
            .attr("fill", "url(#seasonality-gradient)")
            .attr("rx", 2);

        // X axis
        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).tickSize(0))
            .selectAll("text")
            .style("color", "#94a3b8")
            .style("font-size", "0.65rem");

        // Y axis
        g.append("g")
            .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2s")))
            .style("color", "#94a3b8")
            .style("font-size", "0.7rem");

        g.select(".domain").remove();
    },

    // ========================================================================
    // TOP EVENTS LIST
    // ========================================================================

    /**
     * Render top events list
     * @param {Array} events - Array of event objects
     * @param {string} containerSelector - CSS selector for container
     * @param {Object} options - {maxItems, onEventClick}
     */
    renderTopEventsList(events, containerSelector, options = {}) {
        if (!events || events.length === 0) return;

        const container = d3.select(containerSelector);
        if (container.empty()) return;

        const maxItems = options.maxItems || 10;
        const onEventClick = options.onEventClick || null;

        const topEvents = events.slice(0, maxItems);

        container.html('');

        topEvents.forEach((event, i) => {
            const item = container.append("div")
                .attr("class", "event-item")
                .style("border-left-color", REGION_COLORS[event.region] || "#64748b")
                .style("animation", `fadeIn 0.3s ease-out ${i * 0.05}s both`)
                .style("cursor", onEventClick ? "pointer" : "default");

            if (onEventClick) {
                item.on("click", () => onEventClick(event));
            }

            item.append("div")
                .attr("class", "event-item-title")
                .text(`${i + 1}. ${event.dyad_name || 'Unknown Event'}`);

            item.append("div")
                .attr("class", "event-item-meta")
                .html(`
                    ${event.date_start || event.year} • 
                    <strong style="color: #ef4444;">${d3.format(",d")(event.best)}</strong> casualties • 
                    <span style="color: ${TYPE_COLORS[event.type_of_violence_name] || '#64748b'};">${event.type_of_violence_name}</span>
                `);
        });
    },

    // ========================================================================
    // VICTIM COMPOSITION CHART (Donut chart)
    // ========================================================================

    /**
     * Draw victim composition donut chart
     * @param {Object} event - Event object with deaths_a, deaths_b, deaths_civilians, deaths_unknown
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height}
     */
    drawVictimChart(event, svgSelector, options = {}) {
        if (!event || event.best <= 100) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) return;

        const width = options.width || container.getBoundingClientRect().width || 300;
        const height = options.height || 260;
        const radius = Math.min(width, height - 60) / 2 - 30;

        svg.attr("width", width).attr("height", height);

        const victims = [
            { category: 'Side A', deaths: event.deaths_a || 0 },
            { category: 'Side B', deaths: event.deaths_b || 0 },
            { category: 'Civilians', deaths: event.deaths_civilians || 0 },
            { category: 'Unknown', deaths: event.deaths_unknown || 0 }
        ].filter(v => v.deaths > 0).sort((a, b) => b.deaths - a.deaths);

        if (victims.length === 0) return;

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2},${(height - 40) / 2})`);

        const color = d3.scaleOrdinal()
            .domain(['Side A', 'Side B', 'Civilians', 'Unknown'])
            .range(['#d62728', '#1f77b4', '#2ca02c', '#7f7f7f']);

        const pie = d3.pie().value(d => d.deaths).sort(null);
        const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);
        const labelArc = d3.arc().innerRadius(radius * 0.9).outerRadius(radius * 0.9);

        const total = d3.sum(victims, v => v.deaths);

        const arcs = g.selectAll(".arc")
            .data(pie(victims))
            .enter()
            .append("g")
            .attr("class", "arc");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.category))
            .attr("stroke", "#0f172a")
            .style("stroke-width", "2px")
            .style("opacity", 0.8)
            .on("mouseover", function () {
                d3.select(this).style("opacity", 1).style("stroke", "#fff");
            })
            .on("mouseout", function () {
                d3.select(this).style("opacity", 0.8).style("stroke", "#0f172a");
            });

        // Labels
        arcs.append("text")
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

        // Legend
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
                .text(`${v.category}: ${d3.format(",d")(v.deaths)}`);
        });
    },

    // ========================================================================
    // CONNECTED FACTIONS CHART (Horizontal bar chart)
    // ========================================================================

    /**
     * Draw connected factions horizontal bar chart
     * @param {Array} factions - [{id, name, casualties, relationshipType}]
     * @param {string} svgSelector - CSS selector for SVG element
     * @param {Object} options - {width, height, onFactionClick}
     */
    drawConnectedFactionsChart(factions, svgSelector, options = {}) {
        if (!factions || factions.length === 0) return;

        const svg = d3.select(svgSelector);
        svg.selectAll("*").remove();

        const container = svg.node()?.parentElement;
        if (!container) return;

        const width = options.width || container.getBoundingClientRect().width || 300;
        const barHeight = 25;
        const maxBars = options.maxBars || 8;
        const topFactions = factions.slice(0, maxBars);
        const height = options.height || (topFactions.length * barHeight + 40);
        const margin = { top: 10, right: 60, bottom: 10, left: 100 };

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        svg.attr("width", width).attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(topFactions, d => d.casualties)])
            .range([0, innerWidth]);

        const y = d3.scaleBand()
            .domain(topFactions.map(d => d.name || d.id))
            .range([0, innerHeight])
            .padding(0.2);

        // Bars
        g.selectAll(".bar")
            .data(topFactions)
            .join("rect")
            .attr("class", "bar")
            .attr("y", d => y(d.name || d.id))
            .attr("width", d => x(d.casualties))
            .attr("height", y.bandwidth())
            .attr("fill", d => d.relationshipType === 'ally' ? '#22c55e' : '#ef4444')
            .attr("rx", 3)
            .style("cursor", options.onFactionClick ? "pointer" : "default")
            .on("click", (event, d) => {
                if (options.onFactionClick) options.onFactionClick(d);
            });

        // Labels (left side - names)
        g.selectAll(".label")
            .data(topFactions)
            .join("text")
            .attr("class", "label")
            .attr("x", -5)
            .attr("y", d => y(d.name || d.id) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("fill", "#64748b")
            .style("font-size", "0.7rem")
            .text(d => {
                const name = d.name || d.id;
                return name.length > 15 ? name.substring(0, 12) + '...' : name;
            });

        // Values (right side)
        g.selectAll(".value")
            .data(topFactions)
            .join("text")
            .attr("class", "value")
            .attr("x", d => x(d.casualties) + 5)
            .attr("y", d => y(d.name || d.id) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .style("fill", "#1e293b")
            .style("font-size", "0.7rem")
            .style("font-weight", "600")
            .text(d => d3.format(",d")(d.casualties));
    },

    // ========================================================================
    // HELPER: Update all charts at once
    // ========================================================================

    /**
     * Update all charts with aggregated data
     * @param {Object} chartData - Output from DataManager.aggregateDataForCharts()
     * @param {Object} selectors - Chart SVG selectors
     * @param {Object} options - Additional options
     */
    updateAllCharts(chartData, selectors = {}, options = {}) {
        const defaultSelectors = {
            timeline: '#chart-timeline',
            violenceType: '#chart-violence-type',
            heatmap: '#chart-victims', // Reusing victims container for heatmap
            seasonality: '#chart-seasonality',
            topEvents: '#chart-top-events'
        };

        const sel = { ...defaultSelectors, ...selectors };

        // Timeline
        if (chartData.byYear && chartData.byYear.length > 0) {
            this.drawTimelineChart(chartData.byYear, sel.timeline, options.timeline);
        }

        // Violence Type
        if (chartData.byViolenceType && chartData.byViolenceType.length > 0) {
            this.drawViolenceTypeChart(chartData.byViolenceType, sel.violenceType, options.violenceType);
        }

        // Heatmap
        if (chartData.byMonth && chartData.byMonth.length > 0) {
            this.drawYearMonthHeatmap(chartData.byMonth, sel.heatmap, options.heatmap);
        }

        // Seasonality
        if (chartData.bySeason && chartData.bySeason.length > 0) {
            this.drawSeasonalityChart(chartData.bySeason, sel.seasonality, options.seasonality);
        }

        // Top Events
        if (chartData.topEvents && chartData.topEvents.length > 0) {
            this.renderTopEventsList(chartData.topEvents, sel.topEvents, options.topEvents);
        }
    }
};
