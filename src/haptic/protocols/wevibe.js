/**
 * We-Vibe Protocol
 *
 * 8-byte binary packets. Supports dual motors (internal/external).
 * Command format from buttplug.io (BSD-3-Clause, Nonpolynomial Labs LLC)
 */

export const wevibe = {
  id: 'wevibe',
  name: 'We-Vibe',

  // We-Vibe uses 0-15 intensity scale per motor (4 bits each)
  maxIntensity: 15,

  /**
   * Build vibrate command
   * @param {number} intensity - 0.0 to 1.0 (applied to both motors)
   * @param {number} intensityExt - Optional separate intensity for external motor
   * @returns {Uint8Array} Command bytes
   */
  buildCommand(intensity, intensityExt = null) {
    const intLevel = Math.round(intensity * this.maxIntensity);
    const extLevel = intensityExt !== null
      ? Math.round(intensityExt * this.maxIntensity)
      : intLevel;

    if (intLevel === 0 && extLevel === 0) {
      // Stop command
      return new Uint8Array([0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    }

    // Combined speed byte: external in low nibble, internal in high nibble
    const combinedSpeed = extLevel | (intLevel << 4);

    return new Uint8Array([
      0x0f,           // Command prefix
      0x03,           // Mode
      0x00,           // Reserved
      combinedSpeed,  // Speed (4 bits each motor)
      0x00,           // Reserved
      0x03,           // Mode repeat
      0x00,           // Reserved
      0x00,           // Reserved
    ]);
  },

  /**
   * Build stop command
   */
  buildStopCommand() {
    return new Uint8Array([0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  },

  /**
   * Initialize We-Vibe device
   */
  async init(writeChar) {
    try {
      // Send init sequence
      await writeChar.writeValue(new Uint8Array([0x0f, 0x03, 0x00, 0x99, 0x00, 0x03, 0x00, 0x00]));
      await writeChar.writeValue(new Uint8Array([0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      return true;
    } catch (e) {
      console.warn('We-Vibe init failed:', e);
      return false;
    }
  },
};
