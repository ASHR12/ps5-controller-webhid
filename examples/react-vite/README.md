# React + Vite example

This standalone app shows a practical React integration using the published
`ps5-controller-webhid` npm package. It exercises both public entry points:

- `ps5-controller-webhid`
- `ps5-controller-webhid/react`

Run it from the repository root:

```bash
cd examples/react-vite
npm install
npm run dev
```

Open the localhost URL in desktop Chrome, Edge, or Opera. Select **Find PS5
controller** and choose a DualSense controller in the WebHID device picker.

The example intentionally resolves the installed npm package from
`node_modules`, rather than the repository's local source aliases. Use
`npm run build` for the TypeScript and production-bundle smoke test.
