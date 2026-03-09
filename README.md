# FL UI Addons

UI enhancements for ComfyUI that restore and improve canvas interaction workflows. All features can be individually toggled on/off from the sidebar settings panel.

## Features

| Feature | Description |
|---------|-------------|
| **Connection Menu on Link Drop** | Dragging a node connection into empty canvas space shows the OG ComfyUI connection menu — a flat, type-filtered list of compatible nodes with "Add Node", "Search", and "Reroute" options. Works regardless of `Comfy.NodeSearchBoxImpl` or `Comfy.LinkRelease.Action` settings. |
| **Force Legacy Search** | Double-clicking empty canvas always opens the legacy litegraph search box, even when `Comfy.NodeSearchBoxImpl` is set to `"default"`. |
| **Taller Results List** | The legacy search box results area is expanded from the default 200px to 70% of the viewport height, showing significantly more nodes at a glance. |
| **Escape to Close** | Press `Escape` to dismiss the connection menu — no need to click off. |
| **Link Cutting** | Hold `Shift` and drag across the canvas to draw a red dotted line that severs any connections it crosses. Supports undo with `Ctrl+Z`. |
| **Sidebar Settings Panel** | A dedicated sidebar button with per-feature toggles. Each feature can be enabled or disabled independently — settings persist across sessions. |

## Installation

### ComfyUI Manager

Search for **"FL UI Addons"** in ComfyUI Manager and click Install.

### Manual

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/filliptm/ComfyUI_FL-UI-Addons.git comfyui-fl-ui-addons
```

Restart ComfyUI. No Python dependencies required.

## Settings

Click the FL UI Addons icon in the sidebar to open the settings panel, or find the settings in ComfyUI's Settings dialog under the `FL UI:` prefix.

| Setting | Default |
|---------|---------|
| Connection Menu on Link Drop | On |
| Force Legacy Search Box | On |
| Taller Search Results | On |
| Shift+Drag Link Cutting | On |

## How It Works

ComfyUI's frontend moved away from the legacy type-filtered connection menu in favor of a Vue-based search dialog. The underlying infrastructure (`Comfy.SlotDefaults`) still populates per-type node suggestions on startup — this extension simply redirects link drops and double-clicks back to the legacy UI that reads from that data.

- **Link drops** are intercepted by patching `linkConnector.dropOnNothing`, bypassing the Vue routing layer entirely.
- **Double-clicks** are intercepted via a capture-phase listener on `litegraph:canvas` events, firing before the Vue handler.
- **Link cutting** uses capture-phase pointer event listeners on `document` to intercept Shift+drag before litegraph processes it, then tests intersection against rendered link `Path2D` objects.

## License

MIT
