/**
 * Vibrator BLE Module
 *
 * Direct Web Bluetooth connection (no Intiface/server required).
 * Device filters and UUIDs from buttplug-device-config (BSD-3-Clause).
 * Protocol command formats from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC).
 *
 * Run `npm run update-devices` to refresh device-config.json.
 */

import deviceConfig from './device-config.json' with { type: 'json' };
import { detectProtocol, lovense, isCoyote, connectCoyote } from './protocols/index.js';

const { filters: FILTERS, services: SERVICES } = deviceConfig;

/**
 * Connect to a BLE vibrator device
 * Auto-detects protocol based on device name and services.
 * @returns {Promise<VibatorDevice>}
 */
export async function connect() {
  const device = await navigator.bluetooth.requestDevice({
    filters: FILTERS,
    optionalServices: SERVICES,
  });

  // Retry connection up to 3 times
  let server, services;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      server = await device.gatt.connect();
      await new Promise(r => setTimeout(r, 300)); // Let connection stabilize
      services = await server.getPrimaryServices();
      break;
    } catch (e) {
      console.warn(`Connection attempt ${attempt} failed:`, e.message);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  let protocol, writeChar;

  // Track if we need writeWithoutResponse (some devices don't support write)
  let useWriteWithoutResponse = false;

  // Special handling for Coyote
  if (isCoyote(device.name)) {
    const result = await connectCoyote(device, server, services);
    writeChar = result.writeChar;
    protocol = result.protocol;
    // V2 characteristics only support writeWithoutResponse
    useWriteWithoutResponse = result.version === 'v2';
    console.log(`Using protocol: ${protocol.name} (${result.version}) for device: ${device.name}`);
  } else {
    // Standard vibrator connection
    protocol = detectProtocol(device.name, services) || lovense;
    console.log(`Using protocol: ${protocol.name} for device: ${device.name}`);

    // Find non-generic service
    let targetService = services.find(s =>
      !s.uuid.startsWith('00001800') && !s.uuid.startsWith('00001801')
    ) || services[0];

    const chars = await targetService.getCharacteristics();
    writeChar = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);

    if (!writeChar) throw new Error('No writable characteristic found');
  }

  // Initialize protocol if needed
  if (protocol.init) {
    await protocol.init(writeChar);
  }

  // State
  let _active = false;
  let _keepaliveTimer = null;
  let _lastCommand = null;
  let _lastIntensity = 0;

  // Helper to write using correct method
  const writeToChar = async (char, data) => {
    if (useWriteWithoutResponse || !char.properties.write) {
      await char.writeValueWithoutResponse(data);
    } else {
      await char.writeValue(data);
    }
  };

  const send = async (intensity) => {
    _lastIntensity = intensity;  // Track for keepalive
    // Use custom sendCommand if protocol provides it (e.g., V2 multi-char writes)
    if (protocol.sendCommand) {
      await protocol.sendCommand(intensity, writeChar);
      _lastCommand = protocol.buildCommand(intensity);  // For keepalive fallback
    } else {
      const cmd = protocol.buildCommand(intensity);
      _lastCommand = cmd;
      await writeToChar(writeChar, cmd);
    }
  };

  // Setup keepalive if protocol requires it
  const startKeepalive = () => {
    if (protocol.keepaliveInterval && !_keepaliveTimer) {
      _keepaliveTimer = setInterval(async () => {
        if (_active) {
          try {
            // Use sendCommand for protocols that need multi-char writes
            if (protocol.sendCommand) {
              await protocol.sendCommand(_lastIntensity, writeChar);
            } else if (_lastCommand) {
              await writeToChar(writeChar, _lastCommand);
            }
          } catch (e) {
            console.warn('Keepalive failed:', e);
          }
        }
      }, protocol.keepaliveInterval);
    }
  };

  const stopKeepalive = () => {
    if (_keepaliveTimer) {
      clearInterval(_keepaliveTimer);
      _keepaliveTimer = null;
    }
  };

  return {
    name: device.name,
    device,
    protocol: protocol.id,

    send,

    async activate(intensity = 0.5) {
      _active = true;
      startKeepalive();
      await send(intensity);
    },

    async stop() {
      _active = false;
      stopKeepalive();
      _lastCommand = null;
      _lastIntensity = 0;
      // Use stopCommand if protocol has it (handles locking for multi-char protocols)
      if (protocol.stopCommand) {
        await protocol.stopCommand();
      } else {
        const cmd = protocol.buildStopCommand ? protocol.buildStopCommand() : protocol.buildCommand(0);
        await writeToChar(writeChar, cmd);
      }
    },

    get isActive() {
      return _active;
    },

    disconnect() {
      stopKeepalive();
      if (server?.connected) {
        server.disconnect();
      }
    },
  };
}
