# Contributing to ps5-controller-webhid

Thanks for helping improve the package and its PS5 Controller Tester.

## Development

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

## Hardware changes

Changes involving WebHID output must:

- require an explicit user action before requesting device permission
- work without transmitting controller data off-device
- stop rumble and reset adaptive triggers after each test
- clean up outputs on disconnect, reload, page exit, and component teardown
- preserve a clear manual confirmation step for effects a browser cannot sense

Test Bluetooth and USB separately when changing report handling. Include the
controller board revision, firmware version, browser, operating system, and
transport when reporting a hardware-specific issue.

## Pull requests

Keep changes focused and explain:

- what behavior changed
- how it was verified
- whether physical controller testing was performed
- any browser or hardware limitations

Do not add analytics, advertising, remote telemetry, AI services, or code that
writes persistent calibration or firmware data without prior project
discussion and explicit safeguards.
