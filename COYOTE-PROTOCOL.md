# Coyote V3 Protocol Brain Dump

## Official Sources

- **Official Protocol Repo**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE
- **V3 Protocol Doc**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/blob/main/coyote/v3/README_V3.md
- **V2 Protocol Doc**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/blob/main/coyote/v2/README_V2.md
- **Waveform Data**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/blob/main/coyote/extra/README.md
- **Web Bluetooth Example**: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/tree/main/coyote/web (zip file)
- **Buttplug Stpihkal Issue**: https://github.com/buttplugio/stpihkal/issues/91 (reverse-engineered V2)
- **ESP32 Reference**: https://github.com/ltx4jay/Coyote-ESP32
- **Python Implementation**: https://github.com/ultravolt/pycoyote

---

## BLE Connection Details

**Device Name Prefix**: `D-LAB ESTIM` (for requestDevice filter)

**V3 Service/Characteristic UUIDs** (use standard Bluetooth base UUID):
```
Base UUID: 0000xxxx-0000-1000-8000-00805f9b34fb

Service 0x180C (Control):
  - Char 0x150A: Write (commands in)
  - Char 0x150B: Notify (responses out)

Service 0x180A (Battery):
  - Char 0x1500: Read/Notify (battery level 0-100)
```

**Full UUIDs for Web Bluetooth**:
```javascript
const COYOTE_V3 = {
  CONTROL_SERVICE: '0000180c-0000-1000-8000-00805f9b34fb',
  WRITE_CHAR:      '0000150a-0000-1000-8000-00805f9b34fb',
  NOTIFY_CHAR:     '0000150b-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  BATTERY_CHAR:    '00001500-0000-1000-8000-00805f9b34fb',
};
```

**V2 UUIDs** (from stpihkal issue - different format):
```javascript
const COYOTE_V2 = {
  SERVICE:      '955a180a-0fe2-f5aa-a094-84b8d4f3e8ad',
  BATTERY:      '955a1500-0fe2-f5aa-a094-84b8d4f3e8ad',
  POWER_CHAR:   '955a1504-0fe2-f5aa-a094-84b8d4f3e8ad', // 3 bytes
  WAVE_A_CHAR:  '955a1505-0fe2-f5aa-a094-84b8d4f3e8ad',
  WAVE_B_CHAR:  '955a1506-0fe2-f5aa-a094-84b8d4f3e8ad',
  CONFIG_CHAR:  '955a1507-0fe2-f5aa-a094-84b8d4f3e8ad',
};
```

**WARNING - V2 Channel Labels are Flipped!**
Despite what the UUIDs suggest, the physical device labels (A/B) are opposite to the protocol:
- Physical Channel A = Protocol's 1506 (labeled "WAVE_B" in docs)
- Physical Channel B = Protocol's 1505 (labeled "WAVE_A" in docs)

This was confirmed through testing. The power encoding bit positions match (A in high bits 11-21, B in low bits 0-10), but you must swap the waveform characteristic assignments to match the physical outputs.

---

## V3 Command Protocol

**Note**: V3 has not been tested for the A/B flip issue found in V2. If V3 channels are also flipped, the fix would be swapping `intensityA`/`intensityB` and the waveform arrays in `buildB0Command`.

### B0 Command (Main Control) - 20 bytes

This is the primary command sent every ~100ms to control both channels.

```
Byte  0:     0xB0 (command header)
Byte  1:     [Seq:4bits][ModeB:2bits][ModeA:2bits]
Byte  2:     Channel A intensity (0-200)
Byte  3:     Channel B intensity (0-200)
Bytes 4-7:   Channel A waveform frequencies (4 samples, 25ms each = 100ms total)
Bytes 8-11:  Channel A waveform intensities (4 samples)
Bytes 12-15: Channel B waveform frequencies (4 samples)
Bytes 16-19: Channel B waveform intensities (4 samples)
```

**Intensity Mode Bits** (2 bits per channel):
| Bits | Meaning |
|------|---------|
| `00` | No change |
| `01` | Relative increase (+value) |
| `10` | Relative decrease (-value) |
| `11` | Absolute set (=value) |

**Sequence Number** (upper 4 bits of byte 1):
- 0 = No feedback requested
- 1-15 = Request B1 response with this seq number

**Intensity Range**: 0-200 (device clamps to configured soft limit)

**Waveform Frequency Values** (transmitted as single byte 0-240):
```javascript
// Input: desired Hz (10-1000)
// Output: protocol byte value (0-240)
function encodeFrequency(hz) {
  if (hz <= 100) return hz;                    // 10-100 direct
  if (hz <= 600) return ((hz - 100) / 5) + 100; // 101-600 -> 100-200
  return ((hz - 600) / 10) + 200;               // 601-1000 -> 200-240
}

// Reverse
function decodeFrequency(val) {
  if (val <= 100) return val;
  if (val <= 200) return ((val - 100) * 5) + 100;
  return ((val - 200) * 10) + 600;
}
```

**Waveform Intensity Range**: 0-100
- Values > 100 are treated as "disable this sample"
- If all 4 samples invalid, channel output stops

---

### BF Command (Configuration) - 7 bytes

Persistent settings, must be re-sent after reconnection.

```
Byte 0:     0xBF (command header)
Byte 1:     Channel A intensity soft limit (0-200)
Byte 2:     Channel B intensity soft limit (0-200)
Byte 3:     Channel A frequency balance (0-255) - affects low-freq impact
Byte 4:     Channel B frequency balance (0-255)
Byte 5:     Channel A intensity balance (0-255) - affects pulse width
Byte 6:     Channel B intensity balance (0-255)
```

No response is sent for BF commands.

---

### B1 Response (Intensity Feedback) - 4 bytes

Sent via notify characteristic when:
- B0 command had non-zero sequence number
- Physical dial changed intensity

```
Byte 0: 0xB1 (response header)
Byte 1: Sequence number (echoes the B0 command)
Byte 2: Current Channel A intensity
Byte 3: Current Channel B intensity
```

---

## V2 Protocol (Legacy - Different Approach)

V2 uses separate characteristics for power and waveforms, with bit-field encoding and byte reversal.

**Power Levels (0x1504)** - 3 bytes:
```
Controls intensity for channels A and B (0-2000 range in V2!)
Format uses bit-field packing with byte reversal
```

**Waveform Parameters (0x1505, 0x1506)**:
- Ax: Number of 1kHz pulses per group (0-31)
- Ay: Delay between pulse groups (timing varies by firmware - 1:1ms or 1:8ms)
- Az: Amplitude/energy multiplier (5-25 for consistent output)

---

## Sample Implementation

```javascript
// Coyote V3 Web Bluetooth Connection
async function connectCoyote() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'D-LAB ESTIM' }],
    optionalServices: [
      '0000180c-0000-1000-8000-00805f9b34fb', // Control
      '0000180a-0000-1000-8000-00805f9b34fb', // Battery
    ]
  });

  const server = await device.gatt.connect();
  const controlService = await server.getPrimaryService('0000180c-0000-1000-8000-00805f9b34fb');
  const writeChar = await controlService.getCharacteristic('0000150a-0000-1000-8000-00805f9b34fb');
  const notifyChar = await controlService.getCharacteristic('0000150b-0000-1000-8000-00805f9b34fb');

  // Subscribe to responses
  await notifyChar.startNotifications();
  notifyChar.addEventListener('characteristicvaluechanged', (event) => {
    const data = new Uint8Array(event.target.value.buffer);
    if (data[0] === 0xB1) {
      console.log(`Intensity feedback: A=${data[2]}, B=${data[3]}`);
    }
  });

  return { device, writeChar };
}

// Build B0 command
function buildB0Command(options = {}) {
  const {
    sequence = 0,        // 0-15, 0 = no feedback
    modeA = 0b11,        // absolute set
    modeB = 0b11,        // absolute set
    intensityA = 0,      // 0-200
    intensityB = 0,      // 0-200
    waveFreqA = [100, 100, 100, 100],   // 4 frequency samples
    waveIntA = [50, 50, 50, 50],        // 4 intensity samples (0-100)
    waveFreqB = [100, 100, 100, 100],
    waveIntB = [50, 50, 50, 50],
  } = options;

  const cmd = new Uint8Array(20);
  cmd[0] = 0xB0;
  cmd[1] = (sequence << 4) | (modeB << 2) | modeA;
  cmd[2] = Math.min(200, Math.max(0, intensityA));
  cmd[3] = Math.min(200, Math.max(0, intensityB));

  // Channel A waveform (4 freq + 4 intensity bytes)
  for (let i = 0; i < 4; i++) {
    cmd[4 + i] = encodeFrequency(waveFreqA[i]);
    cmd[8 + i] = Math.min(100, Math.max(0, waveIntA[i]));
  }

  // Channel B waveform
  for (let i = 0; i < 4; i++) {
    cmd[12 + i] = encodeFrequency(waveFreqB[i]);
    cmd[16 + i] = Math.min(100, Math.max(0, waveIntB[i]));
  }

  return cmd;
}

function encodeFrequency(hz) {
  hz = Math.min(1000, Math.max(10, hz));
  if (hz <= 100) return hz;
  if (hz <= 600) return Math.round((hz - 100) / 5) + 100;
  return Math.round((hz - 600) / 10) + 200;
}

// Simple usage: set both channels to intensity, 100Hz steady wave
async function activateCoyote(writeChar, intensity) {
  const level = Math.round(intensity * 200); // 0-1 -> 0-200
  const cmd = buildB0Command({
    sequence: 1,
    intensityA: level,
    intensityB: level,
    waveFreqA: [100, 100, 100, 100],
    waveIntA: [50, 50, 50, 50],
    waveFreqB: [100, 100, 100, 100],
    waveIntB: [50, 50, 50, 50],
  });
  await writeChar.writeValue(cmd);
}

// Stop: set intensity to 0
async function stopCoyote(writeChar) {
  const cmd = buildB0Command({
    intensityA: 0,
    intensityB: 0,
  });
  await writeChar.writeValue(cmd);
}

// Continuous control loop (call every 100ms)
let coyoteInterval = null;
function startCoyoteLoop(writeChar, getIntensity) {
  coyoteInterval = setInterval(async () => {
    const intensity = getIntensity(); // 0-1
    await activateCoyote(writeChar, intensity);
  }, 100);
}

function stopCoyoteLoop() {
  if (coyoteInterval) {
    clearInterval(coyoteInterval);
    coyoteInterval = null;
  }
}
```

---

## Waveform Patterns

The waveform system allows creating patterns by varying the 4 samples sent every 100ms:

**Steady Wave**:
```javascript
waveFreqA: [100, 100, 100, 100],  // Constant 100Hz
waveIntA:  [50, 50, 50, 50],       // Constant 50% intensity
```

**Pulsing Wave**:
```javascript
waveFreqA: [100, 100, 100, 100],
waveIntA:  [100, 0, 100, 0],      // On-off-on-off every 25ms
```

**Rising Wave**:
```javascript
waveFreqA: [100, 100, 100, 100],
waveIntA:  [25, 50, 75, 100],     // Ramp up over 100ms
```

**Frequency Sweep**:
```javascript
waveFreqA: [50, 100, 200, 400],   // Low to high
waveIntA:  [50, 50, 50, 50],
```

---

## Size Estimate for Combined POC

```
Current Lovense POC:           ~15 KB (409 lines)
Coyote module addition:        ~3-4 KB (~100 lines)
Unified device abstraction:    ~1-2 KB (~50 lines)
-------------------------------------------
Total estimated:               ~20 KB

vs buttplug-wasm:              1,500-5,000 KB
```

**Still ~75-250x smaller than buttplug-wasm.**

---

## Edge Cases & Safety Notes

1. **Intensity Soft Limits**: Use BF command to set max intensity caps
2. **Update Rate**: V3 expects B0 every 100ms; faster is ignored, slower may cause stuttering
3. **Reconnection**: Must resend BF config after each connection
4. **Channel Independence**: Can control A and B separately with different waveforms
5. **E-Stim Safety**: Unlike vibrators, e-stim can cause muscle contractions - always start at 0 and ramp slowly

---

## Unified Device Detection

```javascript
// Unified device detection for both Lovense and Coyote
async function detectDevice() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: 'LVS-' },        // Lovense
      { namePrefix: 'D-LAB ESTIM' }, // Coyote
    ],
    optionalServices: [
      // Lovense
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      '50300001-0024-4bd4-bbd5-a6920e4c5653',
      '53300001-0023-4bd4-bbd5-a6920e4c5653',
      '54300001-0023-4bd4-bbd5-a6920e4c5653',
      '57300001-0023-4bd4-bbd5-a6920e4c5653',
      '58300001-0023-4bd4-bbd5-a6920e4c5653',
      '4c300001-0024-4bd4-bbd5-a6920e4c5653',
      // Coyote V3
      '0000180c-0000-1000-8000-00805f9b34fb',
      '0000180a-0000-1000-8000-00805f9b34fb',
    ]
  });

  if (device.name.startsWith('LVS-')) {
    return { type: 'lovense', device };
  } else if (device.name.startsWith('D-LAB')) {
    return { type: 'coyote', device };
  }
  return { type: 'unknown', device };
}
```

---

## Why Buttplug/Intiface Won't Support Coyote

From https://github.com/buttplugio/buttplug/issues/445 - they consider e-stim devices too risky for their liability model. xtoys.app supports it but is closed-source. The official DG-LAB-OPENSOURCE repo provides everything needed for direct implementation.
