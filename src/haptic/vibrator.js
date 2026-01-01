/**
 * Vibrator BLE Module
 *
 * Direct Web Bluetooth connection (no Intiface/server required).
 * Device filters and UUIDs from buttplug-device-config (BSD-3-Clause).
 *
 * Run `npm run update-devices` to refresh device-config.json.
 *
 * NOTE: Command format is currently Lovense-specific. Other brands may need
 * device-specific command builders added later.
 */

import deviceConfig from './device-config.json' with { type: 'json' };

const { filters: FILTERS, services: SERVICES } = deviceConfig;

function buildCommand(intensity) {
  // Lovense uses 0-20 scale
  return `Vibrate:${Math.round(intensity * 20)};`;
}

/**
 * Connect to a Lovense device
 * @returns {Promise<LovenseDevice>}
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

  // Find non-generic service
  let targetService = services.find(s =>
    !s.uuid.startsWith('00001800') && !s.uuid.startsWith('00001801')
  ) || services[0];

  const chars = await targetService.getCharacteristics();
  const writeChar = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);

  if (!writeChar) throw new Error('No writable characteristic found');

  // Use closure instead of `this` to avoid binding issues
  let _active = false;

  const send = async (intensity) => {
    const cmd = buildCommand(intensity);
    const data = new TextEncoder().encode(cmd);
    await writeChar.writeValue(data);
  };

  return {
    name: device.name,
    device,

    send,

    async activate(intensity = 0.5) {
      _active = true;
      await send(intensity);
    },

    async stop() {
      _active = false;
      await send(0);
    },

    get isActive() {
      return _active;
    }
  };
}
