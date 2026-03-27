import { app } from "../../../scripts/app.js";
import { patchConnectionMenu } from "./features/connectionMenu.js";
import { patchLegacySearch } from "./features/legacySearch.js";
import { patchLinkCutting } from "./features/linkCutting.js";
import { patchTrackpadNav } from "./features/trackpadNav.js";

app.registerExtension({
    name: "FL.UIAddons",

    async setup() {
        const patchCanvas = () => {
            const canvas = app.canvas;
            if (!canvas || canvas._flUIAddonsPatched) return;
            if (!canvas.linkConnector) return;

            const canvasEl = canvas.canvas;

            patchConnectionMenu(canvas);
            patchLegacySearch(canvas);
            patchLinkCutting(canvas, canvasEl);
            patchTrackpadNav(canvas, canvasEl);

            canvas._flUIAddonsPatched = true;
            console.log("[FL UI Addons] Canvas patched — connection menu, legacy search, link cutting, trackpad nav enabled.");
        };

        patchCanvas();
        setTimeout(patchCanvas, 1000);
        setTimeout(patchCanvas, 3000);
    }
});
