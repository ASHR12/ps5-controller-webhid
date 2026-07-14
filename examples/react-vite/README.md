# React + Vite integration example

This standalone app reproduces the complete polished controller tester while
using the published `ps5-controller-webhid` package from npm. It demonstrates:

- [Package installation and version details](https://www.npmjs.com/package/ps5-controller-webhid)
- browser permission and controller connection
- live buttons, sticks, triggers, touch, motion, and device identity
- haptic and adaptive-trigger tests
- copy-ready framework-independent and React integration patterns

Run it from the repository root:

```bash
cd examples/react-vite
npm install
npm run dev
```

Open the localhost URL in desktop Chrome, Edge, or Opera. Select **Find PS5
controller** and choose a DualSense controller in the WebHID device picker.

The example intentionally resolves the installed npm package from
`node_modules`, rather than the repository's local source aliases. This makes
it both a real-world implementation reference and a smoke test for the
published artifact. Use `npm run build` for the TypeScript and production
bundle checks.
