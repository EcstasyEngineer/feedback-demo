/**
 * Lovense Protocol
 *
 * Text-based commands over BLE. Yes, really - they use ASCII strings.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const lovense = {
  id: 'lovense',
  name: 'Lovense',

  // Lovense uses 0-20 intensity scale
  maxIntensity: 20,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity) {
    const level = Math.round(intensity * this.maxIntensity);
    const cmd = `Vibrate:${level};`;
    return new TextEncoder().encode(cmd);
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    return new TextEncoder().encode('Vibrate:0;');
  },

  /**
   * No initialization required for Lovense
   */
  async init(writeChar) {
    // Lovense doesn't need init
    return true;
  },
};
