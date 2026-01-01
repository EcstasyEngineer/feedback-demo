/**
 * Satisfyer Protocol
 *
 * Binary protocol. Requires init command, then sends 4 bytes per motor.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const satisfyer = {
  id: 'satisfyer',
  name: 'Satisfyer',

  // Satisfyer uses 0-100 intensity scale (or 0-255?)
  maxIntensity: 100,

  // Number of motors (usually 1-2)
  motorCount: 1,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0
   * @param {number} motorCount - Number of motors (default 1)
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, motorCount = 1) {
    const level = Math.round(intensity * this.maxIntensity);
    // Each motor gets 4 identical bytes of the speed value
    const bytes = [];
    for (let i = 0; i < motorCount; i++) {
      bytes.push(level, level, level, level);
    }
    return new Uint8Array(bytes);
  },

  /**
   * Build stop command
   */
  buildStopCommand(motorCount = 1) {
    return this.buildCommand(0, motorCount);
  },

  /**
   * Initialize Satisfyer device
   * Must send 0x01 to Command endpoint before use
   */
  async init(writeChar) {
    try {
      await writeChar.writeValue(new Uint8Array([0x01]));
      return true;
    } catch (e) {
      console.warn('Satisfyer init failed:', e);
      return false;
    }
  },

  /**
   * Satisfyer needs keepalive every ~3 seconds
   */
  keepaliveInterval: 3000,
};
