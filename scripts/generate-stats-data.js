/**
 * Generate Statistics Data Files
 * 
 * This script processes GEDEvent_v25_1.csv and creates smaller JSON files
 * for each chart type, enabling faster page load in statistics.html
 * 
 * Run with: node generate-stats-data.js
 */

const fs = require('fs');
const path = require('path');

// Read and parse CSV
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Handle quoted fields with commas
        const values = [];
        let current = '';
        let inQuotes = false;

        for (const char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        data.push(row);
    }

    return data;
}

// Configuration
const REGION_COLORS = {
    'Africa': '#002D40',
    'Americas': '#991332',
    'Asia': '#FF7747',
    'Europe': '#FFC76E',
    'Middle East': '#0097AB'
};

const VIOLENCE_TYPE_INFO = {
    1: { name: 'State-based', color: '#991332' },
    2: { name: 'Non-state', color: '#FF7747' },
    3: { name: 'One-sided', color: '#0097AB' }
};

console.log('Starting data generation...');
console.log('Reading GEDEvent_v25_1.csv...');

// Read the CSV file
const csvPath = path.join(__dirname, 'GEDEvent_v25_1.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const rawData = parseCSV(csvContent);

console.log(`Loaded ${rawData.length} rows from CSV`);

// Process and clean data
const gedData = rawData
    .map(d => ({
        id: parseInt(d.id) || 0,
        year: parseInt(d.year) || 0,
        country: d.country || '',
        region: d.region || '',
        type_of_violence: parseInt(d.type_of_violence) || 0,
        best: parseInt(d.best) || 0,
        high: parseInt(d.high) || 0,
        low: parseInt(d.low) || 0
    }))
    .filter(d => d.year >= 1989 && d.year <= 2023 && !isNaN(d.best));

console.log(`Processed ${gedData.length} valid events`);

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    console.log('Created data/ directory');
}

// ============================================================
// 1. HISTOGRAM DATA - Event count by fatality bins
// ============================================================
console.log('Generating histogram data...');

const bins = [
    { label: '1-5', min: 1, max: 5 },
    { label: '6-10', min: 6, max: 10 },
    { label: '11-25', min: 11, max: 25 },
    { label: '26-50', min: 26, max: 50 },
    { label: '51-100', min: 51, max: 100 },
    { label: '101-250', min: 101, max: 250 },
    { label: '251-500', min: 251, max: 500 },
    { label: '500+', min: 501, max: Infinity }
];

const histogramData = bins.map(bin => ({
    label: bin.label,
    count: gedData.filter(d => d.best >= bin.min && d.best <= bin.max).length
}));

fs.writeFileSync(
    path.join(dataDir, 'histogram_data.json'),
    JSON.stringify(histogramData, null, 2)
);
console.log('  -> histogram_data.json created');

// ============================================================
// 2. BOX PLOT DATA - Casualties by region
// ============================================================
console.log('Generating box plot data...');

const regions = [...new Set(gedData.map(d => d.region))].filter(r => r);

const boxplotData = regions.map(region => {
    const values = gedData
        .filter(d => d.region === region)
        .map(d => d.best)
        .sort((a, b) => a - b);

    const n = values.length;
    if (n === 0) return null;

    const q1Idx = Math.floor(n * 0.25);
    const medIdx = Math.floor(n * 0.5);
    const q3Idx = Math.floor(n * 0.75);

    const q1 = values[q1Idx];
    const median = values[medIdx];
    const q3 = values[q3Idx];
    const iqr = q3 - q1;
    const min = Math.max(values[0], q1 - 1.5 * iqr);
    const max = Math.min(values[n - 1], q3 + 1.5 * iqr);

    return {
        region,
        min,
        q1,
        median,
        q3,
        max,
        count: n,
        color: REGION_COLORS[region] || '#666'
    };
}).filter(d => d !== null);

fs.writeFileSync(
    path.join(dataDir, 'boxplot_data.json'),
    JSON.stringify(boxplotData, null, 2)
);
console.log('  -> boxplot_data.json created');

// ============================================================
// 3. STACKED BAR DATA - Regional conflicts by year
// ============================================================
console.log('Generating stacked bar data...');

const years = [...new Set(gedData.map(d => d.year))].sort((a, b) => a - b);
const sampledYears = years.filter((y, i) => i % 2 === 0); // Every 2 years

const stackedBarData = {
    years: sampledYears,
    regions: Object.keys(REGION_COLORS),
    regionColors: REGION_COLORS,
    data: sampledYears.map(year => {
        const yearData = { year };
        Object.keys(REGION_COLORS).forEach(region => {
            yearData[region] = gedData.filter(d => d.year === year && d.region === region).length;
        });
        return yearData;
    })
};

fs.writeFileSync(
    path.join(dataDir, 'stacked_bar_data.json'),
    JSON.stringify(stackedBarData, null, 2)
);
console.log('  -> stacked_bar_data.json created');

// ============================================================
// 4. VIOLIN PLOT DATA - Casualties by year groups
// ============================================================
console.log('Generating violin plot data...');

const yearBins = [
    { label: '1989-1994', min: 1989, max: 1994 },
    { label: '1995-1999', min: 1995, max: 1999 },
    { label: '2000-2004', min: 2000, max: 2004 },
    { label: '2005-2009', min: 2005, max: 2009 },
    { label: '2010-2014', min: 2010, max: 2014 },
    { label: '2015-2019', min: 2015, max: 2019 },
    { label: '2020-2023', min: 2020, max: 2023 }
];

const violinData = yearBins.map(bin => {
    const values = gedData
        .filter(d => d.year >= bin.min && d.year <= bin.max)
        .map(d => Math.min(d.best, 100)); // Cap at 100 for visualization

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    return {
        label: bin.label,
        values: values, // Full distribution for KDE
        count: n,
        median: n > 0 ? sorted[Math.floor(n / 2)] : 0,
        mean: n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0
    };
});

fs.writeFileSync(
    path.join(dataDir, 'violin_data.json'),
    JSON.stringify(violinData, null, 2)
);
console.log('  -> violin_data.json created');

// ============================================================
// 5. HEATMAP DATA - Event intensity by region and year
// ============================================================
console.log('Generating heatmap data...');

const heatmapYears = years.filter((y, i) => i % 3 === 0); // Every 3 years

const heatmapCells = [];
regions.forEach(region => {
    heatmapYears.forEach(year => {
        const count = gedData.filter(d => d.region === region && d.year === year).length;
        heatmapCells.push({ region, year, count });
    });
});

const heatmapData = {
    regions: regions,
    years: heatmapYears,
    data: heatmapCells,
    maxCount: Math.max(...heatmapCells.map(d => d.count))
};

fs.writeFileSync(
    path.join(dataDir, 'heatmap_data.json'),
    JSON.stringify(heatmapData, null, 2)
);
console.log('  -> heatmap_data.json created');

// ============================================================
// 6. WAFFLE CHART DATA - Violence type distribution
// ============================================================
console.log('Generating waffle chart data...');

const typeCounts = {};
gedData.forEach(d => {
    const type = d.type_of_violence;
    if (!typeCounts[type]) {
        typeCounts[type] = 0;
    }
    typeCounts[type]++;
});

const total = gedData.length;

const waffleData = Object.entries(typeCounts).map(([type, count]) => ({
    type: parseInt(type),
    name: VIOLENCE_TYPE_INFO[type]?.name || `Type ${type}`,
    count,
    percentage: (count / total) * 100,
    color: VIOLENCE_TYPE_INFO[type]?.color || '#666'
}));

fs.writeFileSync(
    path.join(dataDir, 'waffle_data.json'),
    JSON.stringify(waffleData, null, 2)
);
console.log('  -> waffle_data.json created');

// ============================================================
// Summary statistics
// ============================================================
console.log('Generating summary statistics...');

const summaryData = {
    totalEvents: gedData.length,
    totalCasualties: gedData.reduce((sum, d) => sum + d.best, 0),
    yearRange: { min: Math.min(...years), max: Math.max(...years) },
    regionsCount: regions.length,
    generated: new Date().toISOString()
};

fs.writeFileSync(
    path.join(dataDir, 'summary_stats.json'),
    JSON.stringify(summaryData, null, 2)
);
console.log('  -> summary_stats.json created');

console.log('\n✅ All data files generated successfully!');
console.log(`   Location: ${dataDir}/`);
console.log('   Files created:');
console.log('     - histogram_data.json');
console.log('     - boxplot_data.json');
console.log('     - stacked_bar_data.json');
console.log('     - violin_data.json');
console.log('     - heatmap_data.json');
console.log('     - waffle_data.json');
console.log('     - summary_stats.json');
