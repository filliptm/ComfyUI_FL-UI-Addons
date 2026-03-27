/**
 * Trackpad Navigation
 * Two-finger scroll pans the canvas; pinch-to-zoom (ctrlKey) zooms.
 */
export function patchTrackpadNav(canvas, canvasEl) {
    document.addEventListener("wheel", (e) => {
        if (!canvasEl.contains(e.target)) return;

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
