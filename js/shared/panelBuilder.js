// ============================================================================
// PANEL BUILDER - HTML generation for panels
// ============================================================================

const PanelBuilder = {
    /**
     * Build stats grid (2x2 or flexible)
     * @param {Array} stats - [{label, value, color}]
     * @returns {string} HTML string
     */
    statsGrid(stats) {
        let html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">`;

        stats.forEach(stat => {
            html += `
                <div style="background: white; padding: 0.75rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 0.75rem; color: #94a3b8;">${stat.label}</div>
                    <div style="font-weight: 700; color: ${stat.color || '#1e293b'};">${stat.value}</div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    },

    /**
     * Build entity header (country/faction name with region)
     * @param {Object} options - {name, subtitle, color}
     * @returns {string} HTML string
     */
    entityHeader(options) {
        return `
            <div style="margin-bottom: 1rem; padding: 0.75rem; background: white; border-radius: 6px; border-left: 4px solid ${options.color || '#3b82f6'};">
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">${options.name}</div>
                <div style="font-size: 0.85rem; color: #64748b;">${options.subtitle || ''}</div>
            </div>
        `;
    },

    /**
     * Build section title
     * @param {string} title - Section title
     * @returns {string} HTML string
     */
    sectionTitle(title) {
        return `<h4 style="margin: 1rem 0 0.5rem 0; font-size: 0.9rem; color: #475569;">${title}</h4>`;
    },

    /**
     * Build info row (label: value)
     * @param {string} label - Label text
     * @param {string} value - Value text
     * @param {string} valueColor - Value color
     * @returns {string} HTML string
     */
    infoRow(label, value, valueColor = '#1e293b') {
        return `
            <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
                <span style="font-size: 0.8rem; color: #64748b;">${label}</span>
                <span style="font-size: 0.8rem; font-weight: 600; color: ${valueColor};">${value}</span>
            </div>
        `;
    },

    /**
     * Build progress bar with label
     * @param {Object} options - {label, value, max, color, showValue}
     * @returns {string} HTML string
     */
    progressBar(options) {
        const percentage = (options.value / options.max) * 100;
        return `
            <div style="margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem;">
                    <span style="color: #475569; font-weight: 500;">${options.label}</span>
                    ${options.showValue !== false ? `<span style="color: #ef4444; font-weight: 600;">${formatNumber(options.value)}</span>` : ''}
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${options.color || '#3b82f6'};"></div>
                </div>
            </div>
        `;
    },

    /**
     * Build casualties breakdown section (for event details)
     * @param {Object} event - Event object with deaths_a, deaths_b, etc.
     * @returns {string} HTML string
     */
    casualtiesBreakdown(event) {
        const casualties = [
            { label: `Side A: ${event.side_a || 'Unknown'}`, value: event.deaths_a || 0, color: '#ef4444' },
            { label: `Side B: ${event.side_b || 'Unknown'}`, value: event.deaths_b || 0, color: '#3b82f6' },
            { label: 'Civilians', value: event.deaths_civilians || 0, color: '#dc2626' },
            { label: 'Unknown', value: event.deaths_unknown || 0, color: '#78716c' }
        ].filter(c => c.value > 0);

        if (casualties.length === 0) return '';

        const total = event.best || d3.sum(casualties, c => c.value);

        let html = `
            <div style="background: white; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem;">
                <div style="height: 24px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex; margin-bottom: 0.75rem;">
        `;

        casualties.forEach(c => {
            const pct = (c.value / total) * 100;
            html += `<div style="width: ${pct}%; height: 100%; background: ${c.color};" title="${c.label}: ${formatNumber(c.value)}"></div>`;
        });

        html += `</div>`;

        casualties.forEach(c => {
            const pct = (c.value / total) * 100;
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 10px; height: 10px; background: ${c.color}; border-radius: 2px;"></div>
                        <span style="font-size: 0.8rem; color: #475569;">${c.label}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 600; color: #1e293b; font-size: 0.85rem;">${formatNumber(c.value)}</span>
                        <span style="font-size: 0.7rem; color: #94a3b8; margin-left: 0.25rem;">(${d3.format(".0%")(pct / 100)})</span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    },

    /**
     * Build country panel (left panel for country view)
     * @param {Object} data - Country data
     * @param {Array} events - Filtered events
     * @returns {string} HTML string
     */
    countryPanel(data, events) {
        const region = data.region || 'Unknown';
        const casualties = d3.sum(events, e => e.best);

        // Get factions
        const factionSet = new Set();
        events.forEach(e => {
            if (e.side_a) factionSet.add(e.side_a);
            if (e.side_b) factionSet.add(e.side_b);
        });

        // Get years
        const years = events.map(e => e.year);
        const minYear = years.length > 0 ? Math.min(...years) : null;
        const maxYear = years.length > 0 ? Math.max(...years) : null;

        let html = `
            <div style="padding: 1.5rem; background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%); border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.2rem; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.5rem;">
                    Country Details
                </h3>
                ${this.entityHeader({ name: data.name, subtitle: region, color: REGION_COLORS[region] || '#64748b' })}
                ${this.statsGrid([
            { label: 'Region', value: region, color: REGION_COLORS[region] || '#64748b' },
            { label: 'Events', value: formatNumber(events.length), color: '#3b82f6' },
            { label: 'Casualties', value: formatNumber(casualties), color: '#ef4444' },
            { label: 'Factions', value: factionSet.size, color: '#8b5cf6' }
        ])}
        `;

        if (minYear && maxYear) {
            html += `
                <div style="background: white; padding: 0.75rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1rem;">
                    <div style="font-size: 0.75rem; color: #94a3b8;">Activity Period</div>
                    <div style="font-weight: 600; color: #64748b;">${minYear} - ${maxYear} (${maxYear - minYear + 1} years)</div>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    },

    /**
     * Build event details panel (right panel for event view)
     * @param {Object} event - Event object
     * @returns {string} HTML string
     */
    eventDetailsPanel(event) {
        let html = `
            <div style="padding: 1rem; background: linear-gradient(135deg, #f8fafc 0%, #fef2f2 100%); border-radius: 8px;">
                ${this.entityHeader({
            name: event.dyad_name || 'Unknown Conflict',
            subtitle: `${event.date_start || event.year} • ${event.type_of_violence_name}`,
            color: TYPE_COLORS[event.type_of_violence_name] || '#64748b'
        })}
                ${this.statsGrid([
            { label: 'Country', value: event.country, color: '#3b82f6' },
            { label: 'Region', value: event.region, color: REGION_COLORS[event.region] || '#64748b' },
            { label: 'Total Casualties', value: formatNumber(event.best), color: '#ef4444' },
            { label: 'Violence Type', value: event.type_of_violence_name, color: TYPE_COLORS[event.type_of_violence_name] }
        ])}
                ${this.sectionTitle('Casualties Breakdown')}
                ${this.casualtiesBreakdown(event)}
        `;

        if (event.where_description) {
            html += `
                ${this.sectionTitle('Location')}
                <div style="background: white; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; color: #475569;">
                    📍 ${event.where_description}
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }
};
