/**
 * Connection Menu on Link Drop
 * Shows the legacy OG ComfyUI connection menu when dropping a link on empty canvas.
 * Includes Escape-to-close behavior.
 */
export function patchConnectionMenu(canvas) {
    const lc = canvas.linkConnector;
    if (!lc) return;

    const origDropOnNothing = lc.dropOnNothing.bind(lc);
    lc.dropOnNothing = function (event) {
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
}
