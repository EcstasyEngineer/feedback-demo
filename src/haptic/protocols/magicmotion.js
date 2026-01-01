/**
 * Magic Motion Protocol (v1)
 *
 * 10+ byte binary packets.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const magicmotion = {
  id: 'magicmotion',
  name: 'Magic Motion',

  // Magic Motion uses 0-255 intensity scale
  maxIntensity: 255,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity) {
    const level = Math.round(intensity * this.maxIntensity);
    return new Uint8Array([
      0x0b,   // Command
      0xff,   // ?
      0x04,   // ?
      0x0a,   // ?
      0x32,   // ?
      0x32,   // ?
      0x00,   // ?
      0x04,   // ?
      0x08,   // ?
      level,  // Speed
      0x64,   // ?
      0x00,   // ?
      0x04,   // ?
      0x08,   // ?
      level,  // Speed (repeat)
    ]);
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    return this.buildCommand(0);
  },

  /**
   * No initialization required
   */
  async init(writeChar) {
    return true;
  },
};
