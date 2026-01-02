# Development Guide

## Project Goals

1. **Fully offline** - Works without internet after initial load
2. **No WASM blob** - Buttplug.io's library is ~5MB; we send a few bytes over BLE instead
3. **Single-file release** - Distributable as one HTML file

## Device Support

### Updating Device UUIDs

Device filters and service UUIDs come from buttplug.io's device config:

```bash
npm run update-devices
```

This pulls from:
- **Source**: https://github.com/buttplugio/buttplug
- **File**: `buttplug-device-config-v4.json`
- **License**: BSD-3-Clause (Nonpolynomial Labs LLC)

The script outputs to `src/haptic/device-config.json` with:
- `filters` - BLE device name patterns for `navigator.bluetooth.requestDevice()`
- `services` - Service UUIDs to request access to

**Note**: Coyote/DG-Lab devices are manually added in the script (not in buttplug due to e-stim liability concerns).

### Protocol Implementations

Command formats are derived from buttplug.io's protocol implementations:
- **Repo**: https://github.com/buttplugio/buttplug
- **Path**: `buttplug/src/server/device/protocol/`
- **License**: BSD-3-Clause

| Protocol | Reference | Market Share (est.) |
|----------|-----------|---------------------|
| Satisfyer | `satisfyer_dual.rs` | ~25% |
| Lovense | `lovense.rs` | ~20% |
| We-Vibe | `wevibe.rs` | ~15% |
| LELO | `lelo.rs` | ~10% |
| Kiiroo | `kiiroo_v2.rs` | ~5% |
| Svakom | `svakom_*.rs` | ~5% |
| Magic Motion | `magic_motion_v*.rs` | ~2% |
| MysteryVibe | `mysteryvibe.rs` | ~1% |
| Aneros | `aneros_vivi.rs` | ~1% |
| **Subtotal** | | **~84%** |

**Coyote (DG-Lab)** is special:
- **Reference**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE
- **License**: MIT
- Not in buttplug (e-stim liability)
- V2 and V3 have different protocols

### Adding a New Manufacturer

1. **Find the protocol** in buttplug's repo under `src/server/device/protocol/`
2. **Create** `src/haptic/protocols/<name>.js`:
   ```js
   /**
    * <Name> Protocol
    *
    * <Brief description of how it works>
    * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
    */
   export const <name> = {
     id: '<name>',
     name: '<Display Name>',
     maxIntensity: <number>,  // Device's native scale

     buildCommand(intensity, motorIndex = 0) {
       // intensity: 0-1 normalized
       // Return: Uint8Array or string
     }
   };
   ```
3. **Register** in `src/haptic/protocols/index.js`:
   - Import the protocol
   - Add to `PROTOCOLS` array with `namePatterns` and optional `serviceUUIDs`
4. **Update device config** if new service UUIDs needed:
   - Add to `scripts/update-devices.js` (like Coyote)
   - Run `npm run update-devices`

## Building

### Development
```bash
npm run dev          # Vite dev server with HTTPS (required for BLE)
```

### Single-File Release
```bash
npm run build        # Outputs dist/index.html (~80KB, ~22KB gzipped)
```

The build:
- Bundles all JS modules
- Minifies code
- Inlines audio as base64 data URL
- Produces one self-contained HTML file

## Architecture Notes

### Speech Recognition

- Uses Web Speech API with offline SODA support (Chrome)
- Enable offline: `chrome://settings/accessibility` → Live Caption (~60MB download)
- Single `SpeechRecognition` instance reused to avoid permission re-prompts
- `continuous: true` + `interimResults: true` for full phrase capture in offline mode

### Config Import/Export

- URL hash format: `#c=<base64 JSON>` (for sharing links)
- Blob format: raw base64 JSON (for offline/file-based sharing)
- Both encode the same structure: `{ prompts: [...], settings: {...} }`
