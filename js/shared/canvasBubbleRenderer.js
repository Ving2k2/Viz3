// ============================================================================
// CANVAS BUBBLE RENDERER - High-performance bubble rendering using Canvas
// Replaces SVG for 5-10x faster rendering with thousands of bubbles
// ============================================================================

class CanvasBubbleRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.bubbles = [];
        this.projection = null;
        this.transform = { x: 0, y: 0, k: 1 };
        this.hoveredBubble = null;
        this.selectedBubble = null;
        this.animationFrame = null;
    }

    /**
     * Initialize canvas renderer
     * @param {HTMLElement} container - Container element for canvas
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Function} projection - D3 projection function
     */
    initialize(container, width, height, projection) {
        // Remove existing canvas if any
        const existing = container.querySelector('.bubble-canvas');
        if (existing) existing.remove();

        // Create main canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'bubble-canvas';
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'all'; // Enable pointer events to detect clicks
        this.canvas.style.zIndex = '100';
        container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.projection = projection;

        // Create offscreen canvas for double buffering
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');

        // Setup event listeners
        this.setupEventListeners();

        return this;
    }

    /**
     * Setup mouse event listeners for interaction
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.transform.x) / this.transform.k;
            const y = (e.clientY - rect.top - this.transform.y) / this.transform.k;

            const hoveredBubble = this.findBubbleAt(x, y);
            if (hoveredBubble !== this.hoveredBubble) {
                this.hoveredBubble = hoveredBubble;

                //Update cursor based on hover state
                this.canvas.style.cursor = hoveredBubble ? 'pointer' : 'default';
                this.render();

                // Show tooltip
                if (hoveredBubble && this.onHover) {
                    this.onHover(e, hoveredBubble);
                } else if (this.onHoverEnd) {
                    this.onHoverEnd();
                }
            }
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.transform.x) / this.transform.k;
            const y = (e.clientY - rect.top - this.transform.y) / this.transform.k;

            const clickedBubble = this.findBubbleAt(x, y);
            if (clickedBubble && this.onClick) {
                e.stopPropagation();
                this.selectedBubble = clickedBubble;
                this.onClick(e, clickedBubble);
                this.render();
            } else if (!clickedBubble && this.onEmptyClick) {
                // Clicked on empty area - call empty click handler
                this.onEmptyClick(e);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredBubble = null;
            if (this.onHoverEnd) this.onHoverEnd();
            this.render();
        });
    }

    /**
     * Find bubble at given coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} Bubble data or null
     */
    findBubbleAt(x, y) {
        // Search in reverse order (top bubbles first)
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const bubble = this.bubbles[i];
            const dx = x - bubble.cx;
            const dy = y - bubble.cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= bubble.r) {
                return bubble;
            }
        }
        return null;
    }

    /**
     * Update zoom transform
     * @param {Object} transform - D3 zoom transform {x, y, k}
     */
    updateTransform(transform) {
        this.transform = transform;
        this.render();
    }

    /**
     * Set bubbles data and render
     * @param {Array} data - Array of bubble data with coordinates
     * @param {Object} options - { radiusScale, colorFn, type, animate }
     */
    setBubbles(data, options = {}) {
        const { radiusScale, colorFn, type = 'conflict', animate = true } = options;

        this.bubbles = data.map(d => {
            let coords;
            if (type === 'event' && d.longitude && d.latitude) {
                coords = this.projection([d.longitude, d.latitude]);
            } else if (d.coordinates) {
                coords = this.projection(d.coordinates);
            } else {
                return null;
            }

            if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return null;

            return {
                data: d,
                cx: coords[0],
                cy: coords[1],
                r: radiusScale ? radiusScale(d.best || d.totalCasualties || 0) : 5,
                targetR: radiusScale ? radiusScale(d.best || d.totalCasualties || 0) : 5,
                color: colorFn ? colorFn(d) : '#3b82f6',
                type: type,
                opacity: animate ? 0 : 0.7, // Start with 0 opacity if animating
                targetOpacity: 0.7
            };
        }).filter(Boolean);

        // Animate bubbles appearing
        if (animate && this.bubbles.length > 0) {
            this._animateBubblesIn();
        } else {
            this.render();
        }
    }

    /**
     * Animate bubbles fading in with size growth
     */
    _animateBubblesIn() {
        const duration = 500; // ms
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);

            this.bubbles.forEach(bubble => {
                bubble.opacity = bubble.targetOpacity * eased;
                bubble.r = bubble.targetR * eased;
            });

            this.render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure final values are set
                this.bubbles.forEach(bubble => {
                    bubble.opacity = bubble.targetOpacity;
                    bubble.r = bubble.targetR;
                });
                this.render();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Progressive bubble loading for very large datasets
     * @param {Array} data - Full dataset
     * @param {Object} options - Render options
     * @param {Function} onProgress - Progress callback
     */
    setBubblesProgressive(data, options = {}, onProgress) {
        const batchSize = 500;
        let index = 0;
        this.bubbles = [];

        const processBatch = () => {
            const batch = data.slice(index, index + batchSize);
            const { radiusScale, colorFn, type = 'event' } = options;

            batch.forEach(d => {
                let coords;
                if (type === 'event' && d.longitude && d.latitude) {
                    coords = this.projection([d.longitude, d.latitude]);
                } else if (d.coordinates) {
                    coords = this.projection(d.coordinates);
                }

                if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    this.bubbles.push({
                        data: d,
                        cx: coords[0],
                        cy: coords[1],
                        r: radiusScale ? radiusScale(d.best || d.totalCasualties || 0) : 5,
                        color: colorFn ? colorFn(d) : '#3b82f6',
                        type: type
                    });
                }
            });

            index += batchSize;
            this.render();

            if (onProgress) {
                onProgress(Math.min(100, Math.round((index / data.length) * 100)));
            }

            if (index < data.length) {
                requestAnimationFrame(processBatch);
            }
        };

        requestAnimationFrame(processBatch);
    }

    /**
     * Render all bubbles to canvas
     */
    render() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(() => {
            this._renderFrame();
        });
    }

    /**
     * Internal render frame
     */
    _renderFrame() {
        const ctx = this.offscreenCtx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Apply transform
        ctx.save();
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.k, this.transform.k);

        // Sort bubbles by size (larger first, so smaller are on top)
        // THEN move selected/hovered bubble to end so it renders on top
        const sortedBubbles = [...this.bubbles].sort((a, b) => {
            const isASelected = a === this.selectedBubble || (this.selectedBubble && a.data === this.selectedBubble.data);
            const isBSelected = b === this.selectedBubble || (this.selectedBubble && b.data === this.selectedBubble.data);
            const isAHovered = a === this.hoveredBubble;
            const isBHovered = b === this.hoveredBubble;

            // Selected bubble should be last (rendered on top)
            if (isASelected && !isBSelected) return 1;
            if (isBSelected && !isASelected) return -1;

            // Hovered bubble should be second to last
            if (isAHovered && !isBHovered) return 1;
            if (isBHovered && !isAHovered) return -1;

            // Otherwise sort by size (larger first)
            return b.r - a.r;
        });

        // Draw bubbles
        sortedBubbles.forEach(bubble => {
            const isHovered = bubble === this.hoveredBubble;
            const isSelected = bubble === this.selectedBubble ||
                (this.selectedBubble && bubble.data === this.selectedBubble.data);
            const isUnselected = this.selectedBubble && !isSelected;

            ctx.beginPath();
            ctx.arc(bubble.cx, bubble.cy, bubble.r, 0, Math.PI * 2);

            // Fill
            if (isUnselected) {
                ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'; // Gray for unselected
            } else {
                ctx.fillStyle = this.hexToRgba(bubble.color, isHovered ? 0.9 : 0.7);
            }
            ctx.fill();

            // Hover ring
            if (isHovered || isSelected) {
                ctx.strokeStyle = isSelected ? '#fbbf24' : '#ffffff';
                ctx.lineWidth = (isSelected ? 3 : 2) / this.transform.k;
                ctx.stroke();
            }
        });

        ctx.restore();

        // Copy to main canvas
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color
     * @param {number} alpha - Alpha value
     * @returns {string} RGBA string
     */
    hexToRgba(hex, alpha) {
        if (!hex) return `rgba(100, 116, 139, ${alpha})`;

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
        }
        return hex;
    }

    /**
     * Update bubble sizes (for zoom)
     * @param {Function} radiusScale - New radius scale function
     */
    updateBubbleSizes(radiusScale) {
        this.bubbles.forEach(bubble => {
            bubble.r = radiusScale(bubble.data.best || bubble.data.totalCasualties || 0);
        });
        this.render();
    }

    /**
     * Select a specific bubble
     * @param {Object} data - Bubble data to select
     */
    selectBubble(data) {
        this.selectedBubble = this.bubbles.find(b => b.data === data) || null;
        this.render();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedBubble = null;
        this.render();
    }

    /**
     * Clear all bubbles
     */
    clear() {
        this.bubbles = [];
        this.hoveredBubble = null;
        this.selectedBubble = null;
        this.render();
    }

    /**
     * Resize canvas
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        this.render();
    }

    /**
     * Destroy renderer
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.bubbles = [];
    }
}

// Export singleton instance
const canvasBubbleRenderer = new CanvasBubbleRenderer();
