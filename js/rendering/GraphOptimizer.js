// ============================================================================
// GRAPH OPTIMIZER - Performance optimization for D3 Force Graph
// Implements progressive warm-up and smart rendering (v2)
// ============================================================================

const GraphOptimizer = {
    WARMUP_TICKS: 300,
    TICKS_PER_FRAME: 15,  // Batch size for progressive rendering

    /**
     * Pre-compute node positions using progressive rendering
     * Uses requestAnimationFrame to avoid blocking the main thread
     * 
     * @param {Object} simulation - D3 force simulation
     * @param {Function} onProgress - Callback for progress updates (0-100)
     * @param {Function} onComplete - Callback when warm-up is complete
     * @returns {Function} Cancel function to stop warm-up early
     */
    progressiveWarmup(simulation, onProgress, onComplete) {
        let tickCount = 0;
        let cancelled = false;

        // Stop simulation auto-running
        simulation.stop();

        console.log('🔥 GraphOptimizer: Starting progressive warm-up...');
        const startTime = performance.now();

        function tickBatch() {
            if (cancelled) {
                console.log('🔥 GraphOptimizer: Warm-up cancelled');
                return;
            }

            // Process batch of ticks
            const batchEnd = Math.min(tickCount + GraphOptimizer.TICKS_PER_FRAME, GraphOptimizer.WARMUP_TICKS);
            for (let i = tickCount; i < batchEnd; i++) {
                simulation.tick();
            }
            tickCount = batchEnd;

            // Report progress
            const progress = Math.round((tickCount / GraphOptimizer.WARMUP_TICKS) * 100);
            if (onProgress) {
                onProgress(progress);
            }

            // Continue or complete
            if (tickCount < GraphOptimizer.WARMUP_TICKS) {
                requestAnimationFrame(tickBatch);
            } else {
                const elapsed = performance.now() - startTime;
                console.log(`🔥 GraphOptimizer: Warm-up complete in ${elapsed.toFixed(0)}ms`);
                if (onComplete) {
                    onComplete();
                }
            }
        }

        // Start progressive warm-up
        requestAnimationFrame(tickBatch);

        // Return cancel function
        return () => {
            cancelled = true;
        };
    },

    /**
     * Synchronous warm-up (fallback - will block UI briefly)
     * Use only when you need positions immediately
     */
    syncWarmup(simulation, ticks = 300) {
        simulation.stop();
        const startTime = performance.now();

        for (let i = 0; i < ticks; i++) {
            simulation.tick();
        }

        console.log(`🔥 GraphOptimizer: Sync warm-up (${ticks} ticks) in ${(performance.now() - startTime).toFixed(0)}ms`);
    },

    /**
     * Smart label visibility based on zoom and node importance
     * Hides less important labels when zoomed out
     * 
     * @param {Selection} labelSelection - D3 selection of label elements
     * @param {number} zoomScale - Current zoom scale
     * @param {Object} options - { threshold, casualtyMin }
     */
    updateLabelVisibility(labelSelection, zoomScale, options = {}) {
        const { threshold = 0.5, casualtyMin = 5000 } = options;

        if (!labelSelection || labelSelection.empty()) return;

        labelSelection.style('opacity', function (d) {
            // Always show if zoomed in enough
            if (zoomScale >= threshold) return 1;

            // When zoomed out, only show high-casualty nodes
            const casualties = d.casualties || d.totalCasualties || 0;
            if (casualties > casualtyMin) return 1;

            // Fade out less important labels
            return 0;
        });
    },

    /**
     * Reduce link visibility when zoomed out to improve performance
     * 
     * @param {Selection} linkSelection - D3 selection of link elements
     * @param {number} zoomScale - Current zoom scale
     */
    updateLinkVisibility(linkSelection, zoomScale) {
        if (!linkSelection || linkSelection.empty()) return;

        const opacity = Math.min(1, Math.max(0.1, zoomScale * 1.5));
        linkSelection.style('opacity', opacity);

        // For very zoomed out views, hide thin links entirely
        if (zoomScale < 0.3) {
            linkSelection.style('display', function (d) {
                const strength = d.strength || d.weight || 1;
                return strength < 5 ? 'none' : null;
            });
        } else {
            linkSelection.style('display', null);
        }
    },

    /**
     * Debounced tick function for smoother rendering
     * Limits render calls to ~60fps even if simulation runs faster
     * 
     * @param {Function} tickFn - The render function to debounce
     * @param {number} delay - Minimum ms between calls (default: 16ms = ~60fps)
     * @returns {Function} Debounced function
     */
    createDebouncedTick(tickFn, delay = 16) {
        let lastTime = 0;
        let frameId = null;

        return function () {
            const now = performance.now();

            if (now - lastTime >= delay) {
                lastTime = now;
                tickFn();
            } else if (!frameId) {
                // Schedule for next frame
                frameId = requestAnimationFrame(() => {
                    frameId = null;
                    lastTime = performance.now();
                    tickFn();
                });
            }
        };
    },

    /**
     * Create optimized simulation with performance-tuned parameters
     * 
     * @param {Array} nodes - Node array
     * @param {Array} links - Link array
     * @param {Object} options - Simulation options
     * @returns {Object} D3 force simulation
     */
    createOptimizedSimulation(nodes, links, options = {}) {
        const {
            width = 800,
            height = 600,
            chargeStrength = -200,
            linkDistance = 80,
            collideRadius = 30
        } = options;

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(linkDistance)
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(chargeStrength)
                .distanceMax(300))  // Limit charge calculation range
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide()
                .radius(d => (d.radius || 10) + collideRadius)
                .strength(0.7))
            .velocityDecay(0.4)  // Higher decay = faster settling
            .alphaDecay(0.01);   // Slower alpha decay = smoother

        return simulation;
    },

    /**
     * Determine if we should use simplified rendering based on data size
     * 
     * @param {number} nodeCount - Number of nodes
     * @param {number} linkCount - Number of links
     * @returns {Object} Rendering recommendations
     */
    getPerformanceRecommendations(nodeCount, linkCount) {
        return {
            // Use Canvas for links if many links
            useCanvasLinks: linkCount > 500,
            // Simplify labels if many nodes
            simplifyLabels: nodeCount > 200,
            // Reduce animation if very complex
            reduceAnimation: nodeCount > 300 || linkCount > 1000,
            // Skip hover effects if performance critical
            skipHoverEffects: nodeCount > 500,
            // Recommended warm-up ticks based on complexity
            warmupTicks: Math.min(500, 100 + nodeCount * 0.5)
        };
    }
};

// Export for use in graph.js
if (typeof window !== 'undefined') {
    window.GraphOptimizer = GraphOptimizer;
}
