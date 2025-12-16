// ============================================================================
// VIEW STATE MANAGER - Centralized state management for all views
// ============================================================================

class ViewStateManager {
    constructor() {
        this.state = {
            mode: 'world', // 'world', 'country', 'event', 'region', 'faction'
            viewHierarchyLevel: 'global', // 'global', 'region', 'country'
            selectedCountryName: null,
            selectedCountryData: null,
            selectedConflictType: null,
            selectedEvent: null,
            selectedRegion: null,
            selectedViolenceType: null,
            selectedFaction: null,
            selectedFactionName: null,
            selectedFactionData: null,
            selectedCountryInFaction: null,
            selectedConnectedFaction: null,
            zoomScale: 1,
            countrySortMode: 'casualties' // 'casualties', 'count', 'average'
        };

        this.history = [];
        this.listeners = new Map();
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Update state and notify listeners
     */
    setState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Notify listeners
        this.notifyListeners(oldState, this.state);
    }

    /**
     * Push current state to history
     */
    pushHistory() {
        this.history.push({
            ...this.state,
            timestamp: Date.now()
        });
    }

    /**
     * Pop state from history
     */
    popHistory() {
        if (this.history.length > 0) {
            const previousState = this.history.pop();
            this.state = { ...previousState };
            delete this.state.timestamp;
            return this.state;
        }
        return null;
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners
     */
    notifyListeners(oldState, newState) {
        this.listeners.forEach((callbacks, key) => {
            if (oldState[key] !== newState[key]) {
                callbacks.forEach(callback => {
                    callback(newState[key], oldState[key], newState);
                });
            }
        });
    }

    /**
     * Reset state to initial values
     */
    reset() {
        this.state = {
            mode: 'world',
            viewHierarchyLevel: 'global',
            selectedCountryName: null,
            selectedCountryData: null,
            selectedConflictType: null,
            selectedEvent: null,
            selectedRegion: null,
            selectedViolenceType: null,
            selectedFaction: null,
            selectedFactionName: null,
            selectedFactionData: null,
            selectedCountryInFaction: null,
            selectedConnectedFaction: null,
            zoomScale: 1,
            countrySortMode: 'casualties'
        };
        this.clearHistory();
    }

    /**
     * Helper: Check if in specific mode
     */
    isMode(mode) {
        return this.state.mode === mode;
    }

    /**
     * Helper: Check if viewing specific entity
     */
    isViewing(entityType) {
        switch (entityType) {
            case 'country':
                return this.state.selectedCountryName !== null;
            case 'event':
                return this.state.selectedEvent !== null;
            case 'region':
                return this.state.selectedRegion !== null;
            case 'faction':
                return this.state.selectedFactionName !== null;
            default:
                return false;
        }
    }
}

// Export singleton instance
const viewStateManager = new ViewStateManager();
