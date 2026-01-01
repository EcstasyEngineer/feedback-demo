/**
 * Lelo Protocol (F1S/F1Sv2)
 *
 * Binary: [0x01, speed1, speed2] for dual motor.
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 *
 * Note: Lelo F1S requires button press after BLE connection before
 * accepting commands. This is a hardware limitation.
 */

export const lelo = {
  id: 'lelo',
  name: 'Lelo',

  // Lelo uses 0-255 intensity scale
  maxIntensity: 255,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0 (applied to both motors)
   * @param {number} intensity2 - Optional second motor intensity
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, intensity2 = null) {
    const level1 = Math.round(intensity * this.maxIntensity);
    const level2 = intensity2 !== null
      ? Math.round(intensity2 * this.maxIntensity)
      : level1;
    return new Uint8Array([0x01, level1, level2]);
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    return new Uint8Array([0x01, 0x00, 0x00]);
  },

  /**
   * No BLE init, but device requires physical button press
   */
  async init(writeChar) {
    // Note: User must press power button on device after connection
    return true;
  },
};
