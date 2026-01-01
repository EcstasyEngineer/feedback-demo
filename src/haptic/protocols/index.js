/**
 * Protocol Registry
 *
 * Auto-detects device protocol based on name/service UUID and returns
 * the appropriate command builder.
 *
 * Command formats from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

import { lovense } from './lovense.js';
import { satisfyer } from './satisfyer.js';
import { wevibe } from './wevibe.js';
import { aneros } from './aneros.js';
import { kiiroo } from './kiiroo.js';
import { svakom } from './svakom.js';
import { lelo } from './lelo.js';
import { magicmotion } from './magicmotion.js';
import { mysteryvibe } from './mysteryvibe.js';
import { coyote, isCoyote, connectCoyote } from './coyote.js';

// Protocol definitions with detection patterns
// Ordered by market share for faster matching
const PROTOCOLS = [
  {
    id: 'satisfyer',
    // ~25% market share
    namePatterns: [/^SF/, /^Satisfyer/i, /^SAT/i],
    serviceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    protocol: satisfyer,
  },
  {
    id: 'lovense',
    // ~20% market share
    namePatterns: [/^LVS-/, /^Lush/, /^Hush/, /^Edge/, /^Osci/, /^Domi/, /^Nora/, /^Max/, /^Ambi/, /^Ferri/, /^Diamo/, /^Dolce/, /^Exomoon/, /^Tenera/, /^Flexer/, /^Gravity/, /^Gemini/, /^Lapis/, /^Solace/i],
    serviceUUIDs: [
      '50300001-0024-4bd4-bbd5-a6920e4c5653',
      '53300001-0023-4bd4-bbd5-a6920e4c5653',
      '57300001-0023-4bd4-bbd5-a6920e4c5653',
      '5a300001-0023-4bd4-bbd5-a6920e4c5653',
      '5a300001-0024-4bd4-bbd5-a6920e4c5653',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    ],
    protocol: lovense,
  },
  {
    id: 'wevibe',
    // ~15% market share
    namePatterns: [/^Cougar/, /^Ditto/, /^Gala/, /^Jive/, /^Match/, /^Melt/, /^Moxie/, /^Nova/, /^Pivot/, /^Rave/, /^Sync/, /^Vector/, /^Verge/, /^Wish/, /^We-Vibe/i],
    serviceUUIDs: ['f000bb03-0451-4000-b000-000000000000'],
    protocol: wevibe,
  },
  {
    id: 'lelo',
    // ~10% market share
    namePatterns: [/^F1s/, /^LELO/i, /^Sona/, /^Tiani/, /^Hugo/, /^Ida/, /^Ina/, /^Lily/, /^Mona/, /^Ora/, /^Sila/, /^Soraya/i],
    serviceUUIDs: [],
    protocol: lelo,
  },
  {
    id: 'kiiroo',
    // ~5% market share
    namePatterns: [/^Onyx/, /^Pearl/, /^Fuse/, /^Titan/, /^Cliona/, /^OhMiBod/i, /^Kiiroo/i],
    serviceUUIDs: [],
    protocol: kiiroo,
  },
  {
    id: 'svakom',
    // ~5% market share
    namePatterns: [/^Svakom/i, /^Emma/, /^Ella/, /^Vicky/, /^Alex/, /^Sam/, /^Iker/, /^Tarax/, /^Pulse/i],
    serviceUUIDs: [],
    protocol: svakom,
  },
  {
    id: 'magicmotion',
    // ~2% market share
    namePatterns: [/^Magic Motion/i, /^Kegel/, /^Flamingo/, /^Candy/, /^Bunny/, /^Eidolon/i],
    serviceUUIDs: [],
    protocol: magicmotion,
  },
  {
    id: 'mysteryvibe',
    // ~1% market share
    namePatterns: [/^Crescendo/, /^Tenuto/, /^Poco/, /^MysteryVibe/i],
    serviceUUIDs: [],
    protocol: mysteryvibe,
  },
  {
    id: 'aneros',
    // ~1% market share
    namePatterns: [/^Vivi/i],
    serviceUUIDs: [],
    protocol: aneros,
  },
  {
    id: 'coyote',
    // E-stim device (not in buttplug due to liability)
    namePatterns: [/^D-LAB ESTIM/i, /^47L/],
    serviceUUIDs: ['0000180c-0000-1000-8000-00805f9b34fb'],
    protocol: coyote,
  },
];

/**
 * Detect protocol based on device name and connected services
 * @param {string} deviceName - BLE device name
 * @param {BluetoothRemoteGATTService[]} services - Connected GATT services
 * @returns {object|null} Protocol handler or null if unknown
 */
export function detectProtocol(deviceName, services) {
  const serviceUUIDs = services.map(s => s.uuid.toLowerCase());

  for (const def of PROTOCOLS) {
    // Check name patterns
    if (def.namePatterns.some(pattern => pattern.test(deviceName))) {
      console.log(`Protocol detected by name: ${def.id}`);
      return def.protocol;
    }

    // Check service UUIDs
    if (def.serviceUUIDs.length > 0 && def.serviceUUIDs.some(uuid => serviceUUIDs.includes(uuid.toLowerCase()))) {
      console.log(`Protocol detected by service UUID: ${def.id}`);
      return def.protocol;
    }
  }

  console.warn(`Unknown device: ${deviceName}, services: ${serviceUUIDs.join(', ')}`);
  return null;
}

/**
 * Get protocol by ID (for manual override)
 */
export function getProtocol(id) {
  const def = PROTOCOLS.find(p => p.id === id);
  return def?.protocol || null;
}

/**
 * List all supported protocols
 */
export function listProtocols() {
  return PROTOCOLS.map(p => ({ id: p.id, name: p.protocol.name }));
}

export { lovense, satisfyer, wevibe, aneros, kiiroo, svakom, lelo, magicmotion, mysteryvibe, coyote, isCoyote, connectCoyote };
