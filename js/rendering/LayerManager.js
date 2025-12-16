// ============================================================================
// LAYER MANAGER - Unified visibility control for Map & Graph Views
// ============================================================================

class LayerManager {
    constructor() {
        // Layer visibility states
        this.layers = {
            // Map view layers
            bubbles: true,
            eventBubbles: true,
            countryFill: true,
            countryBorders: true,

            // Graph view layers
            nodes: true,
            links: true,
            labels: true,

            // Shared layers
            tooltip: true
        };

        // Dynamic layer properties (affected by zoom, etc.)
        this.dynamicProps = {
            labelOpacity: 1,
            linkOpacity: 1,
            bubbleScale: 1
        };

        this.listeners = new Map();
    }

    /**
     * Set visibility for a specific layer
     * @param {string} layerName - Layer name
     * @param {boolean} visible - Whether layer should be visible
     */
    setLayerVisibility(layerName, visible) {
        if (this.layers.hasOwnProperty(layerName)) {
            const oldValue = this.layers[layerName];
            this.layers[layerName] = visible;

            if (oldValue !== visible) {
                this.emit('visibility-change', {
                    layer: layerName,
                    visible,
                    allLayers: { ...this.layers }
                });
            }
        }
    }

    /**
     * Toggle layer visibility
     * @param {string} layerName - Layer name
     * @returns {boolean} New visibility state
     */
    toggleLayer(layerName) {
        if (this.layers.hasOwnProperty(layerName)) {
            this.setLayerVisibility(layerName, !this.layers[layerName]);
            return this.layers[layerName];
        }
        return false;
    }

    /**
     * Check if layer is visible
     * @param {string} layerName - Layer name
     * @returns {boolean}
     */
    isVisible(layerName) {
        return this.layers[layerName] ?? true;
    }

    /**
     * Get all layer states
     * @returns {Object}
     */
    getAllLayers() {
        return { ...this.layers };
    }

    /**
     * Smart rendering adjustments based on zoom level
     * Automatically hides/shows layers for better performance
     * 
     * @param {number} zoomScale - Current zoom scale
     * @param {string} viewType - 'map' or 'graph'
     */
    updateForZoom(zoomScale, viewType = 'map') {
        // Update dynamic properties
        this.dynamicProps.labelOpacity = zoomScale > 0.5 ? 1 : 0;
        this.dynamicProps.linkOpacity = Math.min(1, zoomScale * 2);
        this.dynamicProps.bubbleScale = Math.max(0.5, Math.min(2, 1 / Math.sqrt(zoomScale)));

        // For graph view, hide labels when very zoomed out
        if (viewType === 'graph') {
            const shouldShowLabels = zoomScale > 0.3;
            if (this.layers.labels !== shouldShowLabels) {
                this.setLayerVisibility('labels', shouldShowLabels);
            }
        }

        // Emit zoom update event
        this.emit('zoom-update', {
            zoomScale,
            viewType,
            dynamicProps: { ...this.dynamicProps }
        });
    }

    /**
     * Apply layer visibility to D3 selections
     * @param {Object} selections - Object with selection names as keys
     */
    applyToSelections(selections) {
        Object.entries(selections).forEach(([name, selection]) => {
            if (selection && !selection.empty()) {
                const layerName = this._mapSelectionToLayer(name);
                const visible = this.isVisible(layerName);
                selection.style('display', visible ? null : 'none');
            }
        });
    }

    /**
     * Map selection name to layer name
     * @private
     */
    _mapSelectionToLayer(selectionName) {
        const mapping = {
            'country-bubbles': 'bubbles',
            'event-bubbles': 'eventBubbles',
            'countries': 'countryFill',
            'graph-nodes': 'nodes',
            'graph-links': 'links',
            'node-labels': 'labels'
        };
        return mapping[selectionName] || selectionName;
    }

    /**
     * Reset all layers to default visibility
     */
    resetLayers() {
        Object.keys(this.layers).forEach(key => {
            this.layers[key] = true;
        });
        this.dynamicProps = {
            labelOpacity: 1,
            linkOpacity: 1,
            bubbleScale: 1
        };
        this.emit('reset', { layers: { ...this.layers } });
    }

    /**
     * Subscribe to layer events
     * @param {string} event - Event name ('visibility-change', 'zoom-update', 'reset')
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.unsubscribe(event, callback);
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error(`LayerManager event error (${event}):`, e);
            }
        });
    }

    /**
     * Unsubscribe from events
     * @param {string} event - Event name
     * @param {Function} callback - Callback to remove
     */
    unsubscribe(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Get dynamic property value
     * @param {string} propName - Property name
     * @returns {number}
     */
    getDynamicProp(propName) {
        return this.dynamicProps[propName] ?? 1;
    }
}

// Export singleton instance
const layerManager = new LayerManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.layerManager = layerManager;
}
