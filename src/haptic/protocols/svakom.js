/**
 * Svakom Protocol (v1)
 *
 * 6-byte binary packets with keepalive requirement.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const svakom = {
  id: 'svakom',
  name: 'Svakom',

  // Svakom uses 0-255 intensity scale
  maxIntensity: 255,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity) {
    const level = Math.round(intensity * this.maxIntensity);
    const multiplier = level === 0 ? 0x00 : 0x01;
    return new Uint8Array([0x55, 0x04, 0x03, 0x00, multiplier, level]);
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    return new Uint8Array([0x55, 0x04, 0x03, 0x00, 0x00, 0x00]);
  },

  /**
   * No initialization required
   */
  async init(writeChar) {
    return true;
  },

  /**
   * Svakom requires keepalive
   */
  keepaliveInterval: 1000,
};
