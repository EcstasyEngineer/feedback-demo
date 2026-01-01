/**
 * Aneros Protocol
 *
 * Simple 2-byte binary: [0xF1 + motor_index, speed]
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const aneros = {
  id: 'aneros',
  name: 'Aneros',

  // Aneros uses 0-255 intensity scale
  maxIntensity: 255,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @param {number} motorIndex - Motor index (0 or 1)
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, motorIndex = 0) {
    const level = Math.round(intensity * this.maxIntensity);
    return new Uint8Array([0xF1 + motorIndex, level]);
  },

  /**
   * Build stop command
   */
  buildStopCommand(motorIndex = 0) {
    return new Uint8Array([0xF1 + motorIndex, 0x00]);
  },

  /**
   * No initialization required for Aneros
   */
  async init(writeChar) {
    return true;
  },
};
