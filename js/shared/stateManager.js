// ============================================================================
// STATE MANAGER - Centralized view state management
// ============================================================================

const VIEW_EVENTS = {
    RENDER_REQUIRED: 'RENDER_REQUIRED',
    STATE_CHANGED: 'STATE_CHANGED',
    CONTEXT_CHANGED: 'CONTEXT_CHANGED',
    NAVIGATION_BACK: 'NAVIGATION_BACK'
};

class ViewStateManager {
    constructor() {
        this.state = {
            mode: 'world', // 'world', 'country', 'event', 'region', 'faction'
            viewHierarchyLevel: 'global',
            selectedCountryName: null,
            selectedCountryData: null,
            selectedEvent: null,
            selectedRegion: null,
            selectedFaction: null,
            selectedViolenceType: null,
            zoomScale: 1,
            previousMode: null
        };
        this.history = [];
        this.listeners = {};
        this.eventListeners = {};
        this.maxHistorySize = 50;
    }

    getState() {
        return this.state;
    }

    setState(updates) {
        const oldState = { ...this.state };
        Object.assign(this.state, updates);
        this.notifyListeners(oldState, this.state);
        return this.state;
    }

    pushHistory() {
        const snapshot = { ...this.state };
        this.history.push(snapshot);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    popHistory() {
        if (this.history.length === 0) return null;
        const previousState = this.history.pop();
        Object.assign(this.state, previousState);
        return previousState;
    }

    clearHistory() {
        this.history = [];
    }

    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    on(eventType, callback) {
        if (!this.eventListeners[eventType]) {
            this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(callback);
        return () => this.off(eventType, callback);
    }

    off(eventType, callback) {
        if (this.eventListeners[eventType]) {
            this.eventListeners[eventType] = this.eventListeners[eventType].filter(cb => cb !== callback);
        }
    }

    emit(eventType, data) {
        if (this.eventListeners[eventType]) {
            this.eventListeners[eventType].forEach(cb => cb(data));
        }
    }

    notifyListeners(oldState, newState) {
        Object.keys(this.listeners).forEach(key => {
            if (oldState[key] !== newState[key]) {
                this.listeners[key].forEach(callback => {
                    callback(newState[key], oldState[key]);
                });
            }
        });
    }

    resetToGlobal() {
        this.setState({
            mode: 'world',
            viewHierarchyLevel: 'global',
            selectedCountryName: null,
            selectedCountryData: null,
            selectedEvent: null,
            selectedRegion: null,
            selectedFaction: null,
            previousMode: null
        });
        this.clearHistory();
        this.emit(VIEW_EVENTS.RENDER_REQUIRED, { type: 'global' });
    }

    navigateBack() {
        if (this.history.length === 0) return false;
        const previousState = this.popHistory();
        if (previousState) {
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, previousState);
            return true;
        }
        return false;
    }

    /**
     * Smooth navigation back through view hierarchy
     * Priority: event -> country/faction -> world
     * @returns {Object} { navigated: boolean, fromMode: string, toMode: string }
     */
    smoothNavigateBack() {
        const currentMode = this.state.mode;
        const result = { navigated: false, fromMode: currentMode, toMode: null };

        // Priority 1: If viewing event, go back to country/faction view
        if (this.state.selectedEvent && (currentMode === 'event' || currentMode === 'country')) {
            this.state.selectedEvent = null;
            this.state.mode = this.state.selectedFaction ? 'faction' : 'country';
            result.toMode = this.state.mode;
            result.navigated = true;
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, { type: 'deselect_event' });
            return result;
        }

        // Priority 2: If in country view with faction filter, clear faction filter
        if (this.state.selectedFaction && currentMode === 'country') {
            this.state.selectedFaction = null;
            result.toMode = 'country';
            result.navigated = true;
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, { type: 'clear_faction_filter' });
            return result;
        }

        // Priority 3: If in country/faction view, go back to world
        if (currentMode === 'country' || currentMode === 'faction') {
            this.state.mode = 'world';
            this.state.selectedCountryName = null;
            this.state.selectedCountryData = null;
            this.state.selectedFaction = null;
            this.state.selectedEvent = null;
            result.toMode = 'world';
            result.navigated = true;
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, { type: 'return_to_world' });
            return result;
        }

        // Priority 4: If in region view, go back to world
        if (currentMode === 'region') {
            this.state.mode = 'world';
            this.state.selectedRegion = null;
            result.toMode = 'world';
            result.navigated = true;
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, { type: 'return_to_world' });
            return result;
        }

        // Already at world view
        return result;
    }

    reset() {
        this.state = {
            mode: 'world',
            viewHierarchyLevel: 'global',
            selectedCountryName: null,
            selectedCountryData: null,
            selectedEvent: null,
            selectedRegion: null,
            selectedFaction: null,
            selectedViolenceType: null,
            zoomScale: 1,
            previousMode: null
        };
        this.history = [];
    }

    isGlobalView() {
        return this.state.mode === 'world' && !this.state.selectedRegion;
    }

    isMode(mode) {
        return this.state.mode === mode;
    }

    getCurrentContext() {
        if (this.state.selectedFaction) {
            return { contextType: 'FACTION', id: this.state.selectedFaction };
        }
        if (this.state.selectedCountryName) {
            return { contextType: 'COUNTRY', id: this.state.selectedCountryName };
        }
        return { contextType: 'GLOBAL', id: null };
    }
}

// Export singleton instance
const viewStateManager = new ViewStateManager();
