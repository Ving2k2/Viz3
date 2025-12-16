// ============================================================================
// CLEANUP MANAGER - Centralized event listener and resource cleanup
// Prevents memory leaks when switching views
// ============================================================================

class CleanupManager {
    constructor() {
        this.listeners = [];
        this.intervals = [];
        this.timeouts = [];
        this.animations = [];
    }

    /**
     * Register an event listener for automatic cleanup
     * @param {Element} element - DOM element
     * @param {string} event - Event type (e.g., 'click', 'mouseover')
     * @param {Function} handler - Event handler function
     * @param {Object} options - Optional addEventListener options
     */
    registerListener(element, event, handler, options = {}) {
        if (!element) return;

        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });

        return () => this.removeListener(element, event, handler);
    }

    /**
     * Remove a specific listener
     */
    removeListener(element, event, handler) {
        element.removeEventListener(event, handler);
        this.listeners = this.listeners.filter(
            l => !(l.element === element && l.event === event && l.handler === handler)
        );
    }

    /**
     * Register an interval for automatic cleanup
     * @param {number} intervalId - ID from setInterval
     */
    registerInterval(intervalId) {
        this.intervals.push(intervalId);
        return intervalId;
    }

    /**
     * Register a timeout for automatic cleanup
     * @param {number} timeoutId - ID from setTimeout
     */
    registerTimeout(timeoutId) {
        this.timeouts.push(timeoutId);
        return timeoutId;
    }

    /**
     * Register a requestAnimationFrame for automatic cleanup
     * @param {number} animationId - ID from requestAnimationFrame
     */
    registerAnimation(animationId) {
        this.animations.push(animationId);
        return animationId;
    }

    /**
     * Cleanup all registered resources
     * Call this when switching views or destroying components
     */
    cleanupAll() {
        // Remove all event listeners
        this.listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                // Element might have been removed from DOM
            }
        });
        this.listeners = [];

        // Clear all intervals
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        // Clear all timeouts
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts = [];

        // Cancel all animation frames
        this.animations.forEach(id => cancelAnimationFrame(id));
        this.animations = [];

        console.log('🧹 CleanupManager: Cleaned up all resources');
    }

    /**
     * Get statistics about registered resources
     */
    getStats() {
        return {
            listeners: this.listeners.length,
            intervals: this.intervals.length,
            timeouts: this.timeouts.length,
            animations: this.animations.length
        };
    }
}

// Export singleton instance
const cleanupManager = new CleanupManager();
