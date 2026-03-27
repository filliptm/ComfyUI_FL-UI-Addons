/**
 * Link Cutting (Shift+Drag)
 * Shift+left-drag on empty canvas draws a red dotted line that severs
 * any connections it intersects. Supports undo via Ctrl+Z.
 */
export function patchLinkCutting(canvas, canvasEl) {
    let cutting = null;

    function toGraphCoords(e) {
        const rect = canvasEl.getBoundingClientRect();
        return [
            (e.clientX - rect.left) / canvas.ds.scale - canvas.ds.offset[0],
            (e.clientY - rect.top) / canvas.ds.scale - canvas.ds.offset[1]
        ];
    }

    document.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || !e.shiftKey || e.ctrlKey || e.altKey) return;
        if (!canvasEl.contains(e.target)) return;

        const [x, y] = toGraphCoords(e);

        const node = canvas.graph.getNodeOnPos(x, y, canvas.visible_nodes, 5);
        if (node) return;

        const dpr = Math.max(window.devicePixelRatio ?? 1, 1);
        const savedLW = canvas.ctx.lineWidth;
        canvas.ctx.lineWidth = (canvas.connections_width || 4) + 7;
        let onLink = false;
        for (const item of canvas.renderedPaths) {
            if (item.path && canvas.ctx.isPointInStroke(item.path, x * dpr, y * dpr)) {
                onLink = true;
                break;
            }
        }
        canvas.ctx.lineWidth = savedLW;
        if (onLink) return;

        e.stopPropagation();
        e.preventDefault();
        cutting = { startX: x, startY: y, endX: x, endY: y };
        canvas.setDirty(true);
    }, true);

    document.addEventListener("pointermove", (e) => {
        if (!cutting) return;
        const [x, y] = toGraphCoords(e);
        cutting.endX = x;
        cutting.endY = y;
        canvas.setDirty(true);
        e.stopPropagation();
    }, true);

    document.addEventListener("pointerup", (e) => {
        if (!cutting) return;
        const [x, y] = toGraphCoords(e);
        cutting.endX = x;
        cutting.endY = y;
        severIntersectedLinks(cutting);
        cutting = null;
        canvas.setDirty(true, true);
        e.stopPropagation();
    }, true);

    const origOnDrawOverlay = canvas.onDrawOverlay;
    canvas.onDrawOverlay = function (ctx) {
        if (origOnDrawOverlay) origOnDrawOverlay.call(canvas, ctx);
        if (!cutting) return;

        const s = canvas.ds.convertOffsetToCanvas([cutting.startX, cutting.startY]);
        const end = canvas.ds.convertOffsetToCanvas([cutting.endX, cutting.endY]);

        ctx.save();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
        ctx.restore();
    };

    function severIntersectedLinks(line) {
        const graph = canvas.graph;
        const dpr = Math.max(window.devicePixelRatio ?? 1, 1);
        const linksToRemove = [];

        const dx = line.endX - line.startX;
        const dy = line.endY - line.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 5) return;

        const steps = Math.max(Math.ceil(length / 3), 10);

        const savedLW = canvas.ctx.lineWidth;
        canvas.ctx.lineWidth = (canvas.connections_width || 4) + 10;

        for (const item of canvas.renderedPaths) {
            if (!item.path) continue;
            if (item.origin_id == null) continue;

            let hit = false;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = line.startX + dx * t;
                const py = line.startY + dy * t;
                if (canvas.ctx.isPointInStroke(item.path, px * dpr, py * dpr)) {
                    hit = true;
                    break;
                }
            }
            if (hit) linksToRemove.push(item.id);
        }

        canvas.ctx.lineWidth = savedLW;

        if (linksToRemove.length > 0) {
            graph.beforeChange();
            for (const linkId of linksToRemove) {
                graph.removeLink(linkId);
            }
            graph.afterChange();
        }
    }
}
