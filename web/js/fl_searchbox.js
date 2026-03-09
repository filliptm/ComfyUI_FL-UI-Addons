import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "FL.SearchBox",

    async setup() {
        const patchCanvas = () => {
            const canvas = app.canvas;
            if (!canvas || canvas._flSearchBoxPatched) return;

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

            canvas._flSearchBoxPatched = true;
            console.log("[FL SearchBox] Canvas patched — link drops will show connection menu, legacy search forced.");
        };

        patchCanvas();
        setTimeout(patchCanvas, 1000);
        setTimeout(patchCanvas, 3000);
    }
});
