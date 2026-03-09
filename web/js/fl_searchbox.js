import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "FL.UIAddons",

    async setup() {
        const patchCanvas = () => {
            const canvas = app.canvas;
            if (!canvas || canvas._flUIAddonsPatched) return;

            const lc = canvas.linkConnector;
            if (!lc) return;

            // Patch dropOnNothing to intercept link drops before any Vue handlers
            const origDropOnNothing = lc.dropOnNothing.bind(lc);
            lc.dropOnNothing = function (event) {
                // Only intercept if there are active render links
                if (!lc.renderLinks || lc.renderLinks.length === 0) {
                    return origDropOnNothing(event);
                }

                const firstLink = lc.renderLinks[0];
                if (!firstLink || !firstLink.fromSlot) {
                    return origDropOnNothing(event);
                }

                const slotType = firstLink.fromSlot.type;
                if (slotType == null || slotType === -1) {
                    return origDropOnNothing(event);
                }

                const connectingTo = lc.state?.connectingTo;
                const sourceNode = firstLink.node;
                const fromSlot = firstLink.fromSlot;
                const afterRerouteId = firstLink.fromReroute?.id;

                // Snap link to drop position (keeps the line visible while menu is open)
                lc.state.snapLinksPos = [event.canvasX, event.canvasY];

                // Build showConnectionMenu options (same as OG ComfyUI)
                let menuOpts;
                if (connectingTo === "input") {
                    menuOpts = {
                        nodeFrom: sourceNode,
                        slotFrom: fromSlot,
                        e: event,
                        afterRerouteId: afterRerouteId
                    };
                } else {
                    menuOpts = {
                        nodeTo: sourceNode,
                        slotTo: fromSlot,
                        e: event,
                        afterRerouteId: afterRerouteId
                    };
                }

                // Show the connection menu (reads from LiteGraph.slot_types_default_in/out)
                const menu = canvas.showConnectionMenu(menuOpts);

                if (!menu) {
                    // Fallback: run original behavior
                    return origDropOnNothing(event);
                }

                // Close menu on Escape key
                const onEscape = (e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.close();
                    }
                };
                document.addEventListener("keydown", onEscape, true);

                // Clean up link connector when menu closes
                const origClose = menu.close.bind(menu);
                menu.close = function () {
                    document.removeEventListener("keydown", onEscape, true);
                    origClose.apply(this, arguments);
                    try {
                        lc.disconnectLinks();
                        lc.reset();
                        canvas.setDirty(true, true);
                    } catch (e) {
                        // Cleanup may already have happened
                    }
                };
            };

            // Force legacy search box on double-click, regardless of settings
            document.addEventListener("litegraph:canvas", (e) => {
                const subType = e.detail?.subType;
                if (subType === "empty-double-click" || subType === "group-double-click") {
                    e.stopImmediatePropagation();
                    canvas.showSearchBox(e.detail.originalEvent);
                }
            }, true);

            // Make legacy search box taller
            if (!document.getElementById("fl-searchbox-styles")) {
                const style = document.createElement("style");
                style.id = "fl-searchbox-styles";
                style.textContent = `
                    .litegraph.litesearchbox .helper {
                        max-height: 70vh !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // ── Link Cutting (Shift+Drag) ──
            // We use DOM-level event listeners on the canvas element because
            // canvas.processMouseDown is captured via .bind() in bindEvents(),
            // so monkey-patching the method on the instance has no effect.
            let cutting = null; // { startX, startY, endX, endY } in graph coords
            const canvasEl = canvas.canvas;

            function toGraphCoords(e) {
                const rect = canvasEl.getBoundingClientRect();
                return [
                    (e.clientX - rect.left) / canvas.ds.scale - canvas.ds.offset[0],
                    (e.clientY - rect.top) / canvas.ds.scale - canvas.ds.offset[1]
                ];
            }

            // Capture-phase pointerdown on the canvas element — fires before
            // litegraph's own capture-phase handler (we register on document,
            // which is higher in the DOM tree, so capture fires first).
            document.addEventListener("pointerdown", (e) => {
                if (e.button !== 0 || !e.shiftKey || e.ctrlKey || e.altKey) return;
                if (!canvasEl.contains(e.target)) return;

                const [x, y] = toGraphCoords(e);

                // Only activate on empty space (no node under cursor)
                const node = canvas.graph.getNodeOnPos(x, y, canvas.visible_nodes, 5);
                if (node) return;

                // Check no link directly under cursor (shift+click on link = reconnect)
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

                // Start cutting — stop the event from reaching litegraph
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

            // Draw the red dotted cutting line
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
                if (length < 5) return; // too short, ignore

                const steps = Math.max(Math.ceil(length / 3), 10);

                // Widen stroke for easier hit detection
                const savedLW = canvas.ctx.lineWidth;
                canvas.ctx.lineWidth = (canvas.connections_width || 4) + 10;

                for (const item of canvas.renderedPaths) {
                    if (!item.path) continue;
                    // Only cut actual links (have origin_id), not reroutes
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

            canvas._flUIAddonsPatched = true;
            console.log("[FL UI Addons] Canvas patched — link drops, legacy search, link cutting enabled.");
        };

        patchCanvas();
        setTimeout(patchCanvas, 1000);
        setTimeout(patchCanvas, 3000);
    }
});
