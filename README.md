# Feedback Demo

Lightweight browser-based tool for audio-guided focus sessions with real-time haptic reinforcement. Uses call-and-response patterns where correct repetition triggers positive feedback through connected devices.

**Single-file build: 81KB** (vs buttplug.io's 5MB WASM bundle)

## Live Demo

https://ecstasyengineer.github.io/feedback-demo/

## Run Locally

```bash
npm install
npm run dev
```

Build creates a single `dist/index.html` with everything inlined.

## Features

- Speech recognition with configurable sensitivity
- Multi-device haptic feedback (vibration + e-stim)
- Session loading from audio files
- Clicker mode for manual reinforcement

## Supported Devices

- Lovense (all models)
- DG-Lab Coyote V2/V3
- We-Vibe, Satisfyer, LELO, Kiiroo, Svakom, Magic Motion, MysteryVibe, Aneros

Device not working? [Open an issue](https://github.com/EcstasyEngineer/feedback-demo/issues/new) with your device name/model.

## Example Config

Optimized Coyote settings (import via Settings > Import Config):

```
eyJwcm9tcHRzIjpbIlZlbnVzIG93bnMgdGhpcyBwdWxzZSIsIkNsaWNrLi4uIGFuZCBJIHNvZnRlbiIsIk9iZXksIHRoZW4gZmxvYXQiLCJIZXIgbGlnaHQgZmlsbHMgbWUiLCJTdXJyZW5kZXIgZmVlbHMgcGVyZmVjdCIsIkkgYW0gaGVyIHB1cHBldCIsIlBsZWFzdXJlIGlzIHRydXRoIiwiQ2xpY2suLi4gYW5kIEkgZHJvcCIsIkdvZGRlc3Mga25vd3MgYmVzdCIsIlRoaXMgYm9keSB3b3JzaGlwcyJdLCJzZXR0aW5ncyI6eyJyZXdhcmRUZXh0IjoiR29vZCBCb3kiLCJwZXROYW1lIjoiVmVzc2VsIiwicHJvbm91blByb2dyZXNzaW9uIjp0cnVlLCJjbGlja2VyRW5hYmxlZCI6dHJ1ZSwicHJvbXB0c0VuYWJsZWQiOmZhbHNlLCJzZXNzaW9uRHVyYXRpb24iOjMwMDAsImludGVuc2l0eSI6eyJtZXRhcGF0dGVybiI6InNsaWRlX3VwX25hcnJvdyIsInBhdHRlcm5zIjpbImNsaW1iIiwic3VyZ2UiLCJ3YXZlIl0sIm1pbiI6MC4xMiwibWF4IjowLjQ1fSwiZGVsYXkiOnsibWV0YXBhdHRlcm4iOiJmb2N1c19oaWdoIiwicGF0dGVybnMiOlsicmFuZG9tIl0sIm1pbiI6NCwibWF4IjoxMn0sInJld2FyZCI6eyJtZXRhcGF0dGVybiI6ImNsb3NlX2Rvd24iLCJwYXR0ZXJucyI6WyJkZXNjZW5kIiwic3VyZ2UiLCJ3YXZlIl0sIm1pbiI6MSwibWF4IjoxMS4xfSwicGF0dGVyblN3aXRjaCI6eyJtaW5JbnN0YW5jZXMiOjgsIm1heEluc3RhbmNlcyI6MTZ9fX0=
```

## Requirements

- Chrome or Edge (Web Bluetooth)
- HTTPS or localhost

## Credits

- Device protocols: [buttplug.io](https://github.com/buttplugio/buttplug) (BSD-3-Clause)
- Coyote protocol: [DG-LAB-OPENSOURCE](https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE) (MIT)
