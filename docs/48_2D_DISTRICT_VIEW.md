# 48 — v1.0-rc8 2D District View

WorldMind v1.0-rc8 tilføjer et **2D SVG kort** over New Aarhus District 01.

## Status

Implementeret i `src/play/district-view.js` + `src/play/web-renderer.js`.

## Hvad der er bygget

- `buildDistrictView(world)` i `src/play/district-view.js`
- `renderDistrictView(view)` i `src/play/web-renderer.js`
- Outputs: SVG med viewBox "0 0 100 100", 4 location nodes + 3 edges

## Locations

| Location | Node ID | Beskrivelse |
|---|---|---|
| Player Apartment | `loc_apartment` | Spillerens start |
| Sara's Café | `loc_cafe` | Forsyningssted |
| Malik's Workshop | `loc_workshop` | Reparation/service |
| Market Street | `loc_market` | Handel + crowd |

## Agent visualization

Hver location viser agent chips med:

- `data-agent-id` marker
- Navn vist ved location

## Location click hook

```html
<g data-location-id="loc_cafe">
  <circle cx="30" cy="30" r="4" />
</g>
```

Click handler i `APP_JS` sender `move_to_location` command til `/api/command`.

## Test

```bash
npm run validate:district-ui  # checker SVG map + location markers
node --test test/v18-district-phone-ui.test.js
```