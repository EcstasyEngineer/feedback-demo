/**
 * Kiiroo Protocol (v2 Vibrator)
 *
 * Simple binary - array of speed bytes, one per motor.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const kiiroo = {
  id: 'kiiroo',
  name: 'Kiiroo',

  // Kiiroo uses 0-255 intensity scale
  maxIntensity: 255,

  // Max 3 motors
  motorCount: 3,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @param {number} motorCount - Number of motors (default 1)
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, motorCount = 1) {
    const level = Math.round(intensity * this.maxIntensity);
    const bytes = new Array(motorCount).fill(level);
    return new Uint8Array(bytes);
  },

  /**
   * Build stop command
   */
  buildStopCommand(motorCount = 1) {
    return new Uint8Array(new Array(motorCount).fill(0));
  },

  /**
   * No initialization required
   */
  async init(writeChar) {
    return true;
  },
};
