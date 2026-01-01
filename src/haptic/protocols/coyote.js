/**
 * DG-Lab Coyote Protocol (V2 + V3)
 *
 * E-stim device with two channels (A/B) and waveform control.
 * Protocol from DG-LAB-OPENSOURCE (MIT License).
 *
 * WARNING: E-stim can cause muscle contractions. Always start at 0 and ramp slowly.
 *
 * Key differences from vibrators:
 * - Two channels mapped to motorIndex 0 (A) and 1 (B)
 * - Waveform parameters: frequency (10-1000Hz) and wave intensity (0-100)
 * - Must send commands every 100ms (keepalive)
 * - Intensity range: V3=0-200, V2=0-2047
 */

// V3 UUIDs (standard Bluetooth base UUID format)
const COYOTE_V3 = {
  CONTROL_SERVICE: '0000180c-0000-1000-8000-00805f9b34fb',
  WRITE_CHAR:      '0000150a-0000-1000-8000-00805f9b34fb',
  NOTIFY_CHAR:     '0000150b-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  BATTERY_CHAR:    '00001500-0000-1000-8000-00805f9b34fb',
};

// V2 UUIDs (custom UUID format, two service variants)
const COYOTE_V2 = {
  SERVICE_A: '955a180a-0fe2-f5aa-a094-84b8d4f3e8ad',  // Read-only service
  SERVICE_B: '955a180b-0fe2-f5aa-a094-84b8d4f3e8ad',  // Writable service
  BATTERY:   '955a1500-0fe2-f5aa-a094-84b8d4f3e8ad',
  POWER:     '955a1504-0fe2-f5aa-a094-84b8d4f3e8ad',  // 3 bytes, power levels
  // Labels swapped: physical A = protocol's 1506, physical B = protocol's 1505
  WAVE_A:    '955a1506-0fe2-f5aa-a094-84b8d4f3e8ad',
  WAVE_B:    '955a1505-0fe2-f5aa-a094-84b8d4f3e8ad',
};

/**
 * Check if device is a Coyote by name
 */
export function isCoyote(deviceName) {
  if (!deviceName) return false;
  const name = deviceName.toLowerCase();
  return name.startsWith('d-lab') ||
         name.startsWith('dg-lab') ||
         name.startsWith('47l') ||
         name.startsWith('coyote') ||
         name.includes('estim');
}

/**
 * Encode frequency (10-1000Hz) to protocol byte (0-240)
 */
function encodeFrequency(hz) {
  hz = Math.min(1000, Math.max(10, hz));
  if (hz <= 100) return hz;
  if (hz <= 600) return Math.round((hz - 100) / 5) + 100;
  return Math.round((hz - 600) / 10) + 200;
}

/**
 * Build B0 command (20 bytes) - main control command
 */
function buildB0Command(options = {}) {
  const {
    sequence = 0,           // 0-15, 0 = no feedback requested
    modeA = 0b11,           // 11 = absolute set
    modeB = 0b11,
    intensityA = 0,         // 0-200
    intensityB = 0,
    waveFreqA = [100, 100, 100, 100],   // 4 frequency samples (Hz)
    waveIntA = [50, 50, 50, 50],        // 4 intensity samples (0-100)
    waveFreqB = [100, 100, 100, 100],
    waveIntB = [50, 50, 50, 50],
  } = options;

  const cmd = new Uint8Array(20);
  cmd[0] = 0xB0;
  cmd[1] = (sequence << 4) | (modeB << 2) | modeA;
  cmd[2] = Math.min(200, Math.max(0, intensityA));
  cmd[3] = Math.min(200, Math.max(0, intensityB));

  // Channel A waveform
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

/**
 * Build BF command (7 bytes) - configuration/soft limits
 */
function buildBFCommand(options = {}) {
  const {
    limitA = 200,           // Max intensity for channel A
    limitB = 200,           // Max intensity for channel B
    freqBalanceA = 160,     // Frequency balance (affects low-freq feel)
    freqBalanceB = 160,
    intBalanceA = 30,       // Intensity balance (affects pulse width)
    intBalanceB = 30,
  } = options;

  return new Uint8Array([
    0xBF,
    limitA,
    limitB,
    freqBalanceA,
    freqBalanceB,
    intBalanceA,
    intBalanceB,
  ]);
}

export const coyote = {
  id: 'coyote',
  name: 'DG-Lab Coyote',
  type: 'estim',

  // Coyote uses 0-200 intensity scale
  maxIntensity: 200,

  // Default waveform (100Hz steady)
  defaultWaveform: {
    freq: [100, 100, 100, 100],
    intensity: [50, 50, 50, 50],
  },

  // State for dual-channel control
  _state: {
    intensityA: 0,
    intensityB: 0,
    waveformA: null,
    waveformB: null,
  },

  /**
   * Build command for simple intensity control
   * @param {number} intensity - 0.0 to 1.0
   * @param {number} motorIndex - 0 = Channel A, 1 = Channel B
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, motorIndex = 0) {
    const level = Math.round(intensity * this.maxIntensity);

    // Update state for the specified channel
    if (motorIndex === 0) {
      this._state.intensityA = level;
    } else {
      this._state.intensityB = level;
    }

    // Build command with both channels' current state
    return buildB0Command({
      intensityA: this._state.intensityA,
      intensityB: this._state.intensityB,
      waveFreqA: this._state.waveformA?.freq || this.defaultWaveform.freq,
      waveIntA: this._state.waveformA?.intensity || this.defaultWaveform.intensity,
      waveFreqB: this._state.waveformB?.freq || this.defaultWaveform.freq,
      waveIntB: this._state.waveformB?.intensity || this.defaultWaveform.intensity,
    });
  },

  /**
   * Build command with full waveform control
   * @param {object} options - Full control options
   */
  buildFullCommand(options) {
    // Update state
    if (options.intensityA !== undefined) this._state.intensityA = options.intensityA;
    if (options.intensityB !== undefined) this._state.intensityB = options.intensityB;
    if (options.waveformA) this._state.waveformA = options.waveformA;
    if (options.waveformB) this._state.waveformB = options.waveformB;

    return buildB0Command({
      intensityA: this._state.intensityA,
      intensityB: this._state.intensityB,
      waveFreqA: this._state.waveformA?.freq || this.defaultWaveform.freq,
      waveIntA: this._state.waveformA?.intensity || this.defaultWaveform.intensity,
      waveFreqB: this._state.waveformB?.freq || this.defaultWaveform.freq,
      waveIntB: this._state.waveformB?.intensity || this.defaultWaveform.intensity,
    });
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    this._state.intensityA = 0;
    this._state.intensityB = 0;
    return buildB0Command({
      intensityA: 0,
      intensityB: 0,
    });
  },

  /**
   * Initialize Coyote - send config command
   */
  async init(writeChar) {
    try {
      // Reset state
      this._state = {
        intensityA: 0,
        intensityB: 0,
        waveformA: null,
        waveformB: null,
      };

      // Send default config
      const config = buildBFCommand({
        limitA: 200,
        limitB: 200,
      });
      await writeChar.writeValue(config);
      return true;
    } catch (e) {
      console.warn('Coyote init failed:', e);
      return false;
    }
  },

  /**
   * Coyote needs commands every 100ms
   */
  keepaliveInterval: 100,

  // Export UUIDs for connection
  uuids: { v3: COYOTE_V3, v2: COYOTE_V2 },

  // Export builders for advanced use
  buildB0Command,
  buildBFCommand,
  encodeFrequency,
};

// ============================================================================
// V2 Protocol Helpers
// ============================================================================

/**
 * Encode V2 power levels (0-2047 for each channel)
 * A in high bits (11-21), B in low bits (0-10)
 */
function encodeV2Power(a, b) {
  a = Math.min(2047, Math.max(0, a));
  b = Math.min(2047, Math.max(0, b));
  const byte0 = b & 0xFF;
  const byte1 = ((b >> 8) & 0x07) | ((a & 0x1F) << 3);
  const byte2 = (a >> 5) & 0x3F;
  return new Uint8Array([byte0, byte1, byte2]);
}

/**
 * Encode V2 waveform: X (pulses 0-31), Y (interval 0-1023), Z (width 0-31)
 * Bits 19-15: Z, Bits 14-5: Y, Bits 4-0: X
 */
function encodeV2Wave(x, y, z) {
  x = Math.min(31, Math.max(0, x));
  y = Math.min(1023, Math.max(0, y));
  z = Math.min(31, Math.max(0, z));
  const byte0 = (x & 0x1F) | ((y & 0x07) << 5);
  const byte1 = (y >> 3) & 0x7F;
  const byte2 = z & 0x1F;
  return new Uint8Array([byte0, byte1, byte2]);
}

// ============================================================================
// Connection Logic
// ============================================================================

/**
 * Connect to a Coyote device
 * Handles both V2 and V3 protocols automatically
 * @param {BluetoothDevice} device - The BLE device
 * @param {BluetoothRemoteGATTServer} server - Connected GATT server
 * @param {BluetoothRemoteGATTService[]} services - Available services
 * @returns {Promise<{writeChar, version, protocol, send, stop, ...}>}
 */
export async function connectCoyote(device, server, services) {
  // Log available services for debugging
  console.log('Coyote: Available services:', services.map(s => s.uuid));

  // Try V3 first
  const v3Service = services.find(s => s.uuid === COYOTE_V3.CONTROL_SERVICE);
  if (v3Service) {
    console.log('Coyote V3 detected');
    return connectV3(device, v3Service);
  }

  // Try V2 - service B first (has writable chars), then service A
  const v2ServiceB = services.find(s => s.uuid === COYOTE_V2.SERVICE_B);
  const v2ServiceA = services.find(s => s.uuid === COYOTE_V2.SERVICE_A);

  if (v2ServiceB || v2ServiceA) {
    console.log('Coyote V2 detected');
    return connectV2(device, server, services, v2ServiceB || v2ServiceA);
  }

  // No known service found - dump all for debugging
  console.log('=== ALL AVAILABLE SERVICES (no Coyote service found) ===');
  for (const svc of services) {
    console.log('Service:', svc.uuid);
    try {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        console.log('  Char:', c.uuid, {
          read: c.properties.read,
          write: c.properties.write,
          writeNoResp: c.properties.writeWithoutResponse,
          notify: c.properties.notify
        });
      }
    } catch (e) {
      console.log('  (could not enumerate characteristics)');
    }
  }

  throw new Error('No known Coyote service found. Check console for available services.');
}

/**
 * Connect to Coyote V3
 */
async function connectV3(device, service) {
  const writeChar = await service.getCharacteristic(COYOTE_V3.WRITE_CHAR);

  // Try to set up notifications
  try {
    const notifyChar = await service.getCharacteristic(COYOTE_V3.NOTIFY_CHAR);
    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', (event) => {
      const data = new Uint8Array(event.target.value.buffer);
      if (data[0] === 0xB1) {
        console.log(`Coyote V3 feedback: A=${data[2]}, B=${data[3]}`);
      }
    });
  } catch (e) {
    console.warn('Could not set up V3 notifications:', e);
  }

  // Initialize with config
  try {
    const config = buildBFCommand({ limitA: 200, limitB: 200 });
    await writeChar.writeValue(config);
  } catch (e) {
    console.warn('Coyote V3 init failed:', e);
  }

  // Reset state
  coyote._state = {
    intensityA: 0,
    intensityB: 0,
    waveformA: null,
    waveformB: null,
  };

  return {
    writeChar,
    version: 'v3',
    protocol: coyote,
  };
}

/**
 * Connect to Coyote V2
 */
async function connectV2(device, server, allServices, primaryService) {
  // V2 might have characteristics split across services - scan all
  console.log('=== SCANNING V2 SERVICES FOR CHARACTERISTICS ===');

  let powerChar = null;
  let waveAChar = null;
  let waveBChar = null;

  // Try each V2 service to find the characteristics
  const v2Services = allServices.filter(s =>
    s.uuid === COYOTE_V2.SERVICE_A || s.uuid === COYOTE_V2.SERVICE_B
  );

  for (const svc of v2Services) {
    try {
      const chars = await svc.getCharacteristics();
      console.log(`Service ${svc.uuid} has ${chars.length} characteristics:`);

      for (const c of chars) {
        console.log(`  ${c.uuid}`, {
          write: c.properties.write,
          writeNoResp: c.properties.writeWithoutResponse
        });

        if (c.uuid === COYOTE_V2.POWER) powerChar = c;
        if (c.uuid === COYOTE_V2.WAVE_A) waveAChar = c;
        if (c.uuid === COYOTE_V2.WAVE_B) waveBChar = c;
      }
    } catch (e) {
      console.log(`  Could not enumerate ${svc.uuid}:`, e.message);
    }
  }

  if (!powerChar) {
    throw new Error('V2 power characteristic not found. Device may use different protocol.');
  }

  console.log('V2 characteristics found:', {
    power: powerChar?.uuid,
    waveA: waveAChar?.uuid,
    waveB: waveBChar?.uuid
  });

  // Create V2-specific device wrapper
  const v2State = {
    intensityA: 0,
    intensityB: 0,
    interval: 100,  // ms between pulse bursts
    connected: true,
  };

  // Listen for disconnect
  device.addEventListener('gattserverdisconnected', () => {
    console.warn('Coyote V2 disconnected');
    v2State.connected = false;
  });

  // V2 protocol needs custom send that writes to multiple characteristics
  // Use lock + pending to prevent "GATT operation already in progress" errors
  let v2Sending = false;
  let v2Pending = null;  // Only keep latest pending intensity (prioritize newest)

  const v2Protocol = {
    ...coyote,
    id: 'coyote-v2',
    name: 'DG-Lab Coyote V2',
    maxIntensity: 2047,  // V2 uses higher range

    // V2 needs custom send - writes waveform + power together
    // This is called by vibrator.js if present
    async sendCommand(intensity, writeChar) {
      if (!v2State.connected) return;

      // If already sending, queue this as pending (replaces any previous pending)
      if (v2Sending) {
        v2Pending = intensity;
        return;
      }

      v2Sending = true;
      const level = Math.round(intensity * 1024);  // Use 50% of max for safety
      v2State.intensityA = level;
      v2State.intensityB = level;

      // V2 waveform: X=pulses, Y=interval(ms), Z=width
      const waveCmd = encodeV2Wave(10, 100, 10);  // 10 pulses, 100ms interval, width 10

      try {
        // Must send waveform with every update
        if (waveAChar) await waveAChar.writeValueWithoutResponse(waveCmd);
        if (waveBChar) await waveBChar.writeValueWithoutResponse(waveCmd);
        // Then power
        await powerChar.writeValueWithoutResponse(encodeV2Power(level, level));
      } catch (e) {
        if (e.message?.includes('disconnected')) {
          console.warn('V2 disconnected');
          v2State.connected = false;
        } else if (!e.message?.includes('in progress')) {
          // Don't log "operation in progress" - we handle that with the lock
          console.error('V2 send error:', e);
        }
      } finally {
        v2Sending = false;
        // Process pending if any (only most recent is kept)
        if (v2Pending !== null) {
          const pending = v2Pending;
          v2Pending = null;
          this.sendCommand(pending, writeChar);
        }
      }
    },

    // Stop command that respects the lock
    async stopCommand() {
      // Wait for any pending send to complete
      while (v2Sending) {
        await new Promise(r => setTimeout(r, 10));
      }
      v2Pending = null;  // Clear any pending
      v2Sending = true;

      try {
        v2State.intensityA = 0;
        v2State.intensityB = 0;
        await powerChar.writeValueWithoutResponse(encodeV2Power(0, 0));
      } catch (e) {
        if (!e.message?.includes('in progress')) {
          console.error('V2 stop error:', e);
        }
      } finally {
        v2Sending = false;
      }
    },

    // Fallback for standard API (returns just power command)
    buildCommand(intensity, motorIndex = 0) {
      const level = Math.round(intensity * 1024);
      if (motorIndex === 0) {
        v2State.intensityA = level;
      } else {
        v2State.intensityB = level;
      }
      return encodeV2Power(v2State.intensityA, v2State.intensityB);
    },

    buildStopCommand() {
      v2State.intensityA = 0;
      v2State.intensityB = 0;
      return encodeV2Power(0, 0);
    },

    async init(writeChar) {
      // Initial waveform setup
      const waveCmd = encodeV2Wave(10, 100, 10);
      try {
        if (waveAChar) await waveAChar.writeValueWithoutResponse(waveCmd);
        if (waveBChar) await waveBChar.writeValueWithoutResponse(waveCmd);
        console.log('V2 waveform init complete');
      } catch (e) {
        console.warn('V2 init failed:', e);
      }
      return true;
    },

    // V2 also needs keepalive
    keepaliveInterval: 100,
  };

  return {
    writeChar: powerChar,
    waveAChar,
    waveBChar,
    version: 'v2',
    protocol: v2Protocol,
    v2State,
  };
}
