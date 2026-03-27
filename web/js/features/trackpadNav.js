/**
 * UI panel selectors that live inside graph-canvas-container but should
 * receive their own scroll events instead of triggering canvas pan.
 * The bottom-panel hosts the logs console (xterm.js), which uses canvas-
 * based rendering and won't be caught by CSS overflow checks alone.
 */
const UI_PANEL_SELECTORS = ".bottom-panel, .side-bar-panel";

/**
 * Returns true if the target element sits inside a UI panel or a
 * CSS-scrollable ancestor (before reaching the boundary element).
 * This prevents us from hijacking wheel events meant for panels
 * like the logs console or sidebars.
 */
function isInsideUIPanel(target, boundary) {
    // Fast path: check if target is inside a known UI panel
    if (target.closest && target.closest(UI_PANEL_SELECTORS)) return true;

    // Generic path: walk up looking for CSS-scrollable ancestors
    let el = target;
    while (el && el !== boundary) {
        if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
            const style = getComputedStyle(el);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;
            if (overflowY === "auto" || overflowY === "scroll" ||
                overflowX === "auto" || overflowX === "scroll") {
                return true;
            }
        }
        el = el.parentElement;
    }
    return false;
}

/**
 * Trackpad Navigation
 * Two-finger scroll pans the canvas; pinch-to-zoom (ctrlKey) zooms.
 * Uses graph-canvas-container so overlays (video previews, text widgets)
 * that float above the canvas still get the pan behavior.
 */
export function patchTrackpadNav(canvas, canvasEl) {
    const container = canvasEl.closest(".graph-canvas-container") ?? canvasEl.parentElement;

    document.addEventListener("wheel", (e) => {
        if (!container.contains(e.target)) return;
        if (isInsideUIPanel(e.target, container)) return;

        if (!e.ctrlKey) {
            // Two-finger scroll → pan the canvas
            e.preventDefault();
            e.stopPropagation();
            canvas.ds.offset[0] -= e.deltaX / canvas.ds.scale;
            canvas.ds.offset[1] -= e.deltaY / canvas.ds.scale;
            canvas.setDirty(true, true);
        }
        // ctrlKey=true (pinch gesture) → falls through to
        // litegraph's existing zoom handler
    }, { capture: true, passive: false });
}
