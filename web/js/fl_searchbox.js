import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "FL.UIAddons",

    async setup() {
        // ── Persistent Settings ──
        const settings = {
            linkDropMenu: app.ui.settings.addSetting({
                id: "FL.UIAddons.LinkDropMenu",
                name: "FL UI: Connection Menu on Link Drop",
                defaultValue: true,
                type: "boolean",
            }),
            forceLegacySearch: app.ui.settings.addSetting({
                id: "FL.UIAddons.ForceLegacySearch",
                name: "FL UI: Force Legacy Search Box",
                defaultValue: true,
                type: "boolean",
            }),
            tallerSearch: app.ui.settings.addSetting({
                id: "FL.UIAddons.TallerSearchResults",
                name: "FL UI: Taller Search Results",
                defaultValue: true,
                type: "boolean",
                onChange(value) {
                    const el = document.getElementById("fl-ui-addons-styles");
                    if (el) el.disabled = !value;
                },
            }),
            linkCutting: app.ui.settings.addSetting({
                id: "FL.UIAddons.LinkCutting",
                name: "FL UI: Shift+Drag Link Cutting",
                defaultValue: true,
                type: "boolean",
            }),
        };

        // ── Sidebar Panel ──
        const iconStyle = document.createElement("style");
        iconStyle.textContent = `.mdi.mdi-gradient-horizontal.side-bar-button-icon { font-size: 2rem; }`;
        document.head.appendChild(iconStyle);

        app.extensionManager.registerSidebarTab({
            id: "fl-ui-addons",
            title: "FL UI Addons",
            tooltip: "FL UI Addons Settings",
            icon: "mdi mdi-gradient-horizontal",
            type: "custom",
            render: (el) => {
                el.style.padding = "12px";
                el.innerHTML = "";

                const title = document.createElement("h3");
                title.textContent = "FL UI Addons";
                title.style.cssText = "margin: 0 0 16px 0; color: var(--fg-color);";
                el.appendChild(title);

                const toggles = [
                    {
                        key: "linkDropMenu",
                        label: "Connection Menu on Link Drop",
                        desc: "Show type-filtered node menu when dropping a link on empty canvas",
                    },
                    {
                        key: "forceLegacySearch",
                        label: "Force Legacy Search Box",
                        desc: "Double-click always opens legacy search regardless of settings",
                    },
                    {
                        key: "tallerSearch",
                        label: "Taller Search Results",
                        desc: "Expand search results height from 200px to 70% viewport",
                    },
                    {
                        key: "linkCutting",
                        label: "Shift+Drag Link Cutting",
                        desc: "Hold Shift and drag to cut connections with a red line",
                    },
                ];

                for (const { key, label, desc } of toggles) {
                    const setting = settings[key];
                    const row = document.createElement("div");
                    row.style.cssText =
                        "margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;";

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = setting.value;
                    checkbox.style.cssText = "margin-top: 3px; cursor: pointer;";
                    checkbox.addEventListener("change", () => {
                        setting.value = checkbox.checked;
                    });

                    const textDiv = document.createElement("div");
                    const labelEl = document.createElement("div");
                    labelEl.textContent = label;
                    labelEl.style.cssText = "font-weight: 600; color: var(--fg-color);";
                    const descEl = document.createElement("div");
                    descEl.textContent = desc;
                    descEl.style.cssText =
                        "font-size: 0.85em; color: var(--descrip-text); margin-top: 2px;";
                    textDiv.appendChild(labelEl);
                    textDiv.appendChild(descEl);

                    row.appendChild(checkbox);
                    row.appendChild(textDiv);
                    el.appendChild(row);
                }
            },
        });

        // ── Canvas Patching ──
        const patchCanvas = () => {
            const canvas = app.canvas;
            if (!canvas || canvas._flUIAddonsPatched) return;

            const lc = canvas.linkConnector;
            if (!lc) return;

            // ── Feature 1: Connection Menu on Link Drop ──
            const origDropOnNothing = lc.dropOnNothing.bind(lc);
            lc.dropOnNothing = function (event) {
                if (!settings.linkDropMenu.value) {
                    return origDropOnNothing(event);
                }

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

                lc.state.snapLinksPos = [event.canvasX, event.canvasY];

                let menuOpts;
                if (connectingTo === "input") {
                    menuOpts = {
                        nodeFrom: sourceNode,
                        slotFrom: fromSlot,
                        e: event,
                        afterRerouteId: afterRerouteId,
                    };
                } else {
                    menuOpts = {
                        nodeTo: sourceNode,
                        slotTo: fromSlot,
                        e: event,
                        afterRerouteId: afterRerouteId,
                    };
                }

                const menu = canvas.showConnectionMenu(menuOpts);

                if (!menu) {
                    return origDropOnNothing(event);
                }

                const onEscape = (e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.close();
                    }
                };
                document.addEventListener("keydown", onEscape, true);

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

            // ── Feature 2: Force Legacy Search Box ──
            document.addEventListener(
                "litegraph:canvas",
                (e) => {
                    if (!settings.forceLegacySearch.value) return;
                    const subType = e.detail?.subType;
                    if (subType === "empty-double-click" || subType === "group-double-click") {
                        e.stopImmediatePropagation();
                        canvas.showSearchBox(e.detail.originalEvent);
                    }
                },
                true
            );

            // ── Feature 3: Taller Search Results ──
            if (!document.getElementById("fl-ui-addons-styles")) {
                const style = document.createElement("style");
                style.id = "fl-ui-addons-styles";
                style.disabled = !settings.tallerSearch.value;
                style.textContent = `
                    .litegraph.litesearchbox .helper {
                        max-height: 70vh !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // ── Feature 4: Link Cutting (Shift+Drag) ──
            let cutting = null;
            const canvasEl = canvas.canvas;

            function toGraphCoords(e) {
                const rect = canvasEl.getBoundingClientRect();
                return [
                    (e.clientX - rect.left) / canvas.ds.scale - canvas.ds.offset[0],
                    (e.clientY - rect.top) / canvas.ds.scale - canvas.ds.offset[1],
                ];
            }

            document.addEventListener(
                "pointerdown",
                (e) => {
                    if (!settings.linkCutting.value) return;
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
                        if (
                            item.path &&
                            canvas.ctx.isPointInStroke(item.path, x * dpr, y * dpr)
                        ) {
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
                },
                true
            );

            document.addEventListener(
                "pointermove",
                (e) => {
                    if (!cutting) return;
                    const [x, y] = toGraphCoords(e);
                    cutting.endX = x;
                    cutting.endY = y;
                    canvas.setDirty(true);
                    e.stopPropagation();
                },
                true
            );

            document.addEventListener(
                "pointerup",
                (e) => {
                    if (!cutting) return;
                    const [x, y] = toGraphCoords(e);
                    cutting.endX = x;
                    cutting.endY = y;
                    severIntersectedLinks(cutting);
                    cutting = null;
                    canvas.setDirty(true, true);
                    e.stopPropagation();
                },
                true
            );

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

            canvas._flUIAddonsPatched = true;
            console.log("[FL UI Addons] Canvas patched — all features enabled.");
        };

        patchCanvas();
        setTimeout(patchCanvas, 1000);
        setTimeout(patchCanvas, 3000);
    },
});
