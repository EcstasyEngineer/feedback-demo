# Haptic Device Research - Shibbydex & Web Bluetooth

## Summary

Shibbydex **used to have** direct Web Bluetooth support (no Intiface needed) in 2022, but removed it in 2023. We built a POC that restores this capability.

---

## What We Built

### File: `haptic-poc.html`

Two connection methods:

1. **Method 1: Intiface WebSocket** - Same as current Shibbydex (requires Intiface Central running on `ws://localhost:12345`)

2. **Method 2: Direct Web Bluetooth** - Browser connects directly to device, no middleware needed
   - Filters for Lovense devices (`namePrefix: 'LVS-'`)
   - Comprehensive list of Lovense service UUIDs (Lush, Hush, Edge, Domi, etc.)
   - Auto-discovers services and writable characteristics
   - Uses Lovense command protocol: `Vibrate:${0-20};`

### How It Works (Method 2)

```javascript
// 1. Request device with filter
navigator.bluetooth.requestDevice({
  filters: [{ namePrefix: 'LVS-' }],
  optionalServices: LOVENSE_SERVICES  // ~20 UUIDs for different models
});

// 2. Connect to GATT server
const server = await device.gatt.connect();

// 3. Get primary services (whichever match optionalServices)
const services = await server.getPrimaryServices();

// 4. Find Lovense service (skip generic 0x1800, 0x1801)
// 5. Get writable characteristic
// 6. Send command: "Vibrate:10;" (0-20 scale)
```

---

## Shibbydex Timeline

| Date | Connection Method | Evidence |
|------|-------------------|----------|
| **Dec 2022** | `ButtplugEmbeddedConnectorOptions` + Web Bluetooth (DIRECT) | `buttplug.min.js` (189KB) contains WASM bindings for `navigator.bluetooth` |
| **Dec 2023** | `ButtplugBrowserWebsocketClientConnector` (Intiface required) | Bundled `haptic-*.js`, WebSocket to localhost:12345 |
| **Dec 2024** | Same as 2023 | Same architecture |

### Why They Removed It (Speculation)
- WASM bundle was huge (~189KB)
- Web Bluetooth has spotty browser support
- Easier to say "install Intiface" than debug browser BT issues
- Intiface handles device protocol complexity

---

## 2022 Script Archive (DOWNLOAD MANUALLY)

Archive.org blocks automated downloads. Open these in browser and Save As:

1. **buttplug.min.js** (189KB - contains WASM + Web Bluetooth):
   ```
   https://web.archive.org/web/20221204193350js_/https://shibbydex.com/js/buttplug.min.js
   ```
   Save to: `shibbydex-2022-buttplug.min.js`

2. **haptic.js** (13KB - Shibbydex integration):
   ```
   https://web.archive.org/web/20221204193350js_/https://shibbydex.com/js/haptic.js
   ```
   Save to: `shibbydex-2022-haptic.js`

### Key Evidence in 2022 Scripts

**buttplug.min.js:**
- `__wbg_bluetooth_cc8e053613d8eeca` - WASM binding for Web Bluetooth
- `__wbg_requestDevice_94797563349e93d8` - WASM binding for requestDevice
- `ButtplugEmbedded` - Embedded server mode

**haptic.js:**
- `new Buttplug.ButtplugEmbeddedConnectorOptions` - Uses embedded connector
- `new Buttplug.ButtplugClient("Client")` - Creates client
- Console log: "WebBluetooth is not supported on this browser" (proves it tries Web BT)

---

## Open Questions for Next Session

### 1. How Does Rust Run in Browser?
The `buttplug.min.js` is `buttplug-rs-ffi` compiled to WebAssembly (WASM):
- Rust code compiles to `.wasm` binary
- `wasm-bindgen` creates JS glue code (`__wbg_*` functions)
- Browser loads WASM, JS bridges to Web APIs (Bluetooth, etc.)

Rust isn't "replacing C++" here - it's being compiled to a portable bytecode that runs in browsers.

### 2. buttplug-rs-ffi vs buttplug-js
- **buttplug-rs-ffi**: Rust implementation compiled to WASM, includes device protocols
- **buttplug-js**: Pure JavaScript client library (connects to Intiface, doesn't embed protocols)
- GitHub says JS moved to: https://github.com/buttplugio/buttplug-js
- The 2022 Shibbydex used the WASM version for in-browser device support

### 3. Which Approach for Our Use Case?

**Option A: Our POC (haptic-poc.html Method 2)**
- Pros: Simple, no dependencies, works now
- Cons: Must implement each device protocol ourselves

**Option B: buttplug-rs-ffi WASM**
- Pros: All device protocols included, battle-tested
- Cons: 189KB bundle, may be outdated, complex build

**Option C: Hybrid**
- Use buttplug-js for protocol handling
- Our own Web Bluetooth connection layer
- Best of both worlds?

---

## Device Support Requirements

### Currently Working (POC Method 2)
- Lovense Hush 2 (and other LVS-* devices)
- Uses Lovense UART protocol

### Needed: DG-Lab Coyote 2/3 E-Stim
- **Problem**: Intiface refuses to support it
- **Solution**: xtoys.app DOES support it
- **Action**: Analyze xtoys code for Coyote protocol

### xtoys Reference
- URL: https://xtoys.app
- Has direct Web Bluetooth
- Supports Coyote e-stim
- Could extract their protocol implementation

---

## Files in This Project

```
./
├── haptic-poc.html              # Early POC (Method 1 + Method 2)
├── haptic-unified.html          # Current unified POC (Lovense + Coyote)
├── HAPTIC-RESEARCH.md           # This documentation
├── COYOTE-PROTOCOL.md           # DG-Lab Coyote V2/V3 protocol docs
├── PROJECT-SPEC.md              # Full project specification
├── speech-demo.html             # Voice transcription demo
└── SPEECH-RECOGNITION-INTEGRATION.md  # Speech API docs
```

---

## Next Steps

1. Verify 2022 buttplug.min.js is indeed buttplug-rs-ffi WASM build
2. Decide: our simple POC vs full buttplug WASM integration
3. Research Coyote e-stim protocol (via xtoys analysis)
4. Build unified solution supporting both Hush 2 + Coyote
