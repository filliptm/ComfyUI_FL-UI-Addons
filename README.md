# FL Search Box

Restores and enhances the legacy node search experience in ComfyUI.

## Features

| Feature | Description |
|---------|-------------|
| **Connection Menu on Link Drop** | Dragging a node connection into empty canvas space shows the OG ComfyUI connection menu — a flat, type-filtered list of compatible nodes with "Add Node", "Search", and "Reroute" options. Works regardless of `Comfy.NodeSearchBoxImpl` or `Comfy.LinkRelease.Action` settings. |
| **Force Legacy Search** | Double-clicking empty canvas always opens the legacy litegraph search box, even when `Comfy.NodeSearchBoxImpl` is set to `"default"`. |
| **Taller Results List** | The legacy search box results area is expanded from the default 200px to 70% of the viewport height, showing significantly more nodes at a glance. |
| **Escape to Close** | Press `Escape` to dismiss the connection menu — no need to click off. |

## Installation

### ComfyUI Manager

Search for **"FL Search Box"** in ComfyUI Manager and click Install.

### Manual

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/filliptm/ComfyUI_FL-SearchBox.git comfyui-fl-searchbox
```

Restart ComfyUI. No Python dependencies required.

## How It Works

ComfyUI's frontend moved away from the legacy type-filtered connection menu in favor of a Vue-based search dialog. The underlying infrastructure (`Comfy.SlotDefaults`) still populates per-type node suggestions on startup — this extension simply redirects link drops and double-clicks back to the legacy UI that reads from that data.

- **Link drops** are intercepted by patching `linkConnector.dropOnNothing`, bypassing the Vue routing layer entirely.
- **Double-clicks** are intercepted via a capture-phase listener on `litegraph:canvas` events, firing before the Vue handler.

## License

MIT
