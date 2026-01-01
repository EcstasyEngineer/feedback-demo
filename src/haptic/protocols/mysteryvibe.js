/**
 * MysteryVibe Protocol
 *
 * Simple binary - array of speed bytes (up to 6 motors on Crescendo).
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const mysteryvibe = {
  id: 'mysteryvibe',
  name: 'MysteryVibe',

  // MysteryVibe uses 0-255 intensity scale
  maxIntensity: 255,

  // Crescendo has 6 motors
  motorCount: 6,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0 (applied to all motors)
   * @param {number} motorCount - Number of motors (default 6)
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, motorCount = 6) {
    const level = Math.round(intensity * this.maxIntensity);
    return new Uint8Array(new Array(motorCount).fill(level));
  },

  /**
   * Build stop command
   */
  buildStopCommand(motorCount = 6) {
    return new Uint8Array(new Array(motorCount).fill(0));
  },

  /**
   * No initialization required
   */
  async init(writeChar) {
    return true;
  },
};
