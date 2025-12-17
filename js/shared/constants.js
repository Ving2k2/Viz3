// ============================================================================
// CONSTANTS - Shared constants for conflict visualization
// ============================================================================

const CSV_FILE_PATH = '../GEDEvent_v25_1.csv';

// Violence type mapping
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

// Region colors
const REGION_COLORS = {
    "Africa": "#e74c3c",
    "Americas": "#9b59b6",
    "Asia": "#f39c12",
    "Europe": "#3498db",
    "Middle East": "#1abc9c"
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
    "Former Yugoslav Republic of Macedonia": "North Macedonia",
    "Croatia": "Croatia",
    "Slovenia": "Slovenia",

    // Asian countries
    "Laos": "Lao PDR",
    "Vietnam": "Vietnam",
    "Viet Nam": "Vietnam",
    "Timor-Leste (East Timor)": "Timor-Leste",
    "East Timor": "Timor-Leste",
    "North Korea": "Dem. Rep. Korea",
    "South Korea": "Korea",
    "Republic of Korea": "Korea",

    // African countries
    "Libya": "Libya",
    "Central African Republic": "Central African Rep.",
    "CAR": "Central African Rep.",
    "South Sudan": "S. Sudan",
    "Ivory Coast": "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Equatorial Guinea": "Eq. Guinea",
    "Western Sahara": "W. Sahara",
    "Guinea-Bissau": "Guinea-Bissau",
    "Eswatini": "eSwatini",
    "Swaziland": "eSwatini",
    "Kingdom of eSwatini (Swaziland)": "eSwatini",

    // European countries
    "Czech Republic": "Czechia",
    "Czechia": "Czechia",
    "Belarus": "Belarus",
    "Byelarus": "Belarus",
    "Belorussia": "Belarus",
    "Moldova": "Moldova",
    "Moldavia": "Moldova",

    // Americas
    "United States": "United States of America",
    "USA": "United States of America",
    "US": "United States of America",
    "U.S.A.": "United States of America",
    "Dominican Republic": "Dominican Rep.",

    // Other
    "Bahrain": "Bahrain",
    "Comoros": "Comoros",
    "Madagascar": "Madagascar",
    "Madagascar (Malagasy)": "Madagascar",
    "Malagasy": "Madagascar",
    "North Macedonia": "North Macedonia",
    "Solomon Islands": "Solomon Is."
};
