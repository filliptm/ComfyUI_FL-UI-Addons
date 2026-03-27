/**
 * Legacy Search Box
 * Forces the legacy litegraph search box on double-click and makes the
 * results list taller (70vh instead of 200px).
 */
export function patchLegacySearch(canvas) {
    document.addEventListener("litegraph:canvas", (e) => {
        const subType = e.detail?.subType;
        if (subType === "empty-double-click" || subType === "group-double-click") {
            e.stopImmediatePropagation();
            canvas.showSearchBox(e.detail.originalEvent);
        }
    }, true);

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
}
