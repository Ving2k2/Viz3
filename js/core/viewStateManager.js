// ============================================================================
// VIEW STATE MANAGER - Centralized state management for all views
// Enhanced with RENDER_REQUIRED events and infinite loop protection (v2)
// ============================================================================

// Event types for state-driven UI
const VIEW_EVENTS = {
    RENDER_REQUIRED: 'RENDER_REQUIRED',
    STATE_CHANGED: 'STATE_CHANGED',
    CONTEXT_CHANGED: 'CONTEXT_CHANGED',  // Country/Faction selection changed
    NAVIGATION_BACK: 'NAVIGATION_BACK'
};

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
        this.eventListeners = new Map(); // For RENDER_REQUIRED events

        // Infinite loop protection
        this._isUpdating = false;
        this._pendingUpdates = {};
        this._updateDepth = 0;
        this._maxUpdateDepth = 3; // Prevent deep recursion
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Update state and notify listeners
     * Protected against infinite loops with batching
     */
    setState(updates) {
        // Guard against infinite loops
        if (this._isUpdating) {
            // Batch updates instead of immediate apply
            Object.assign(this._pendingUpdates, updates);
            console.log('📌 ViewStateManager: Batching update (in progress)');
            return;
        }

        // Check recursion depth
        this._updateDepth++;
        if (this._updateDepth > this._maxUpdateDepth) {
            console.warn('⚠️ ViewStateManager: Max update depth reached, preventing infinite loop');
            this._updateDepth = 0;
            return;
        }

        this._isUpdating = true;
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Apply any batched updates
        if (Object.keys(this._pendingUpdates).length > 0) {
            Object.assign(this.state, this._pendingUpdates);
            this._pendingUpdates = {};
        }

        // Notify property listeners
        this.notifyListeners(oldState, this.state);

        // Emit RENDER_REQUIRED for view-affecting changes
        const renderTriggers = ['mode', 'selectedCountryName', 'selectedFaction', 'selectedEvent'];
        const shouldRender = renderTriggers.some(key => oldState[key] !== this.state[key]);
        if (shouldRender) {
            this.emit(VIEW_EVENTS.RENDER_REQUIRED, {
                oldState,
                newState: this.state,
                changedKeys: renderTriggers.filter(key => oldState[key] !== this.state[key])
            });
        }

        this._isUpdating = false;
        this._updateDepth = 0;
    }

    /**
     * Push current state to history
     */
    pushHistory() {
        // Limit history size
        if (this.history.length >= 20) {
            this.history.shift();
        }
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

            // Emit navigation event
            this.emit(VIEW_EVENTS.NAVIGATION_BACK, { state: this.state });
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
     * Subscribe to property changes
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
     * Subscribe to events (RENDER_REQUIRED, etc.)
     */
    on(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(callback);

        // Return unsubscribe function
        return () => this.off(eventType, callback);
    }

    /**
     * Unsubscribe from events
     */
    off(eventType, callback) {
        const callbacks = this.eventListeners.get(eventType);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(eventType, data) {
        const callbacks = this.eventListeners.get(eventType) || [];
        callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error(`ViewStateManager event error (${eventType}):`, e);
            }
        });
    }

    /**
     * Notify property listeners
     */
    notifyListeners(oldState, newState) {
        this.listeners.forEach((callbacks, key) => {
            if (oldState[key] !== newState[key]) {
                callbacks.forEach(callback => {
                    try {
                        callback(newState[key], oldState[key], newState);
                    } catch (e) {
                        console.error(`ViewStateManager listener error (${key}):`, e);
                    }
                });
            }
        });
    }

    /**
     * Reset to global view - STATE-DRIVEN approach
     * Back button calls this, UI auto-updates via RENDER_REQUIRED
     */
    resetToGlobal() {
        console.log('🔄 ViewStateManager: Resetting to global view');

        this.setState({
            mode: 'world',
            viewHierarchyLevel: 'global',
            selectedCountryName: null,
            selectedCountryData: null,
            selectedEvent: null,
            selectedFaction: null,
            selectedFactionName: null,
            selectedFactionData: null,
            selectedCountryInFaction: null,
            selectedConnectedFaction: null
        });
        this.clearHistory();

        // Emit specific event for global reset
        this.emit(VIEW_EVENTS.CONTEXT_CHANGED, { context: 'GLOBAL', id: null });
    }

    /**
     * Navigate back using history stack
     * Returns true if navigated, false if at root
     */
    navigateBack() {
        const previousState = this.popHistory();
        if (previousState) {
            // Apply previous state (will trigger RENDER_REQUIRED)
            this.setState(previousState);
            return true;
        } else {
            // At root, reset to global
            this.resetToGlobal();
            return false;
        }
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
     * Helper: Check if in global view
     */
    isGlobalView() {
        return this.state.mode === 'world' &&
            !this.state.selectedCountryName &&
            !this.state.selectedFaction;
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

    /**
     * Get current context for Filter Funnel
     * @returns {Object} { contextType: 'GLOBAL'|'COUNTRY'|'FACTION', id: string|null }
     */
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

// Export singleton instance and event types
const viewStateManager = new ViewStateManager();
