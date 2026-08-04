# UPDATE_DOWNLOAD_REPORT

Date: 2026-08-03

## Summary

Implemented the installer download → launch → quit flow for NovaFetch updates. Clicking **Update / Update Now** in the `UpdateAvailableDialog` now downloads the installer from `UpdateCheckResult.downloadUrl` to the OS temp directory, reports progress on the button, launches the installer, and gracefully quits the app. On any failure NovaFetch stays open and the error is surfaced in a toast.

## Files Modified

| File | Change |
| --- | --- |
| `src/app/App.tsx` | Implemented `handleUpdate()`: validation, progress subscription, double-click guard, error toasts, launch orchestration. Added `updateDownloading` / `updateProgress` state and `updateInFlightRef`. |
| `src/features/dialogs/UpdateAvailableDialog.tsx` | Added `downloading` / `progress` props. Update button is disabled while downloading and shows `Downloading… N%`. Layout unchanged. |
| `electron/ipc/update.ipc.ts` | Added `update:download` and `update:launch` IPC handlers plus an `app.on('will-quit')` temp-dir sweep that skips the just-launched installer. |
| `electron/preload.ts` | Exposed `update.download(url)`, `update.launch(path)`, `update.onDownloadProgress(cb)` on `window.electron.update`. |
| `src/types/electron.d.ts` | Typed the new `download` / `launch` / `onDownloadProgress` APIs and added `downloadUrl` to `UpdateCheckResult`. |
| `electron/services/updateService.ts` | Surface `downloadUrl` from the parsed manifest into `UpdateCheckResult` (no change to checking/version/parsing logic). |
| `electron/services/__tests__/updateService.test.ts` | Expected `downloadUrl` in the full-result assertion. |
| `electron/services/__tests__/updateStartup.test.ts` | Added `downloadUrl` to mocked `UpdateCheckResult` objects. |

## IPC Added

- `update:download(url)` → `{ ok: true, path } | { ok: false, error }`
  - Validates the URL (must be `http:`/`https:`).
  - Streams the installer into `<app.getPath('temp')>/novafetch-update/<filename>`.
  - Emits `update:download-progress` `{ received, total, percent }` events to the renderer (`percent` is `null` when the server sends no `content-length`).
  - Deletes the partial file on any failure.
- `update:launch(installerPath)` → `{ ok: true } | { ok: false, error }`
  - Verifies the installer exists on disk.
  - Launches it via `shell.openPath`.
  - On success schedules `app.quit()` after 500 ms.
  - On failure returns the error and leaves the app open.
- `update:download-progress` — main → renderer event channel (no renderer response needed).

## Download Flow

1. Renderer validates `result.downloadUrl` is non-empty; shows an error toast and returns otherwise.
2. Renderer sets `downloading = true`, disables the Update button, subscribes to `onDownloadProgress`.
3. Renderer invokes `update:download(url)`.
4. Main validates the URL, then streams the response body through a byte-counting `Transform` into a temp file, sending progress events as bytes arrive.
5. Main verifies the file exists, then returns `{ ok: true, path }`.

**Not used:** the download manager, the Downloads list, and the user's download folder. The file lives only in the OS temp dir.

**Dismissal guard:** the dialog (X / Later / Escape / backdrop) cannot be dismissed while `downloading` is true, so an in-flight download is never orphaned.

## Installer Launch Flow

1. Renderer invokes `update:launch(installerPath)`.
2. Main checks `fs.existsSync(installerPath)`; missing file → `{ ok: false }` (app stays open).
3. Main calls `shell.openPath(installerPath)`; shell error → `{ ok: false }` (app stays open).
4. On success main schedules `app.quit()` after 500 ms and returns `{ ok: true }` — the installer runs independently and replaces the app.
5. Renderer treats a failed launch as an error: toast shown, button re-enabled, app kept open.

## Cleanup Flow

- **Download failure / HTTP error / network error / invalid URL:** main deletes the partial file (`fs.rmSync(destPath, { force: true })`) before returning the error. No temp file is left behind.
- **App exit:** `app.on('will-quit')` sweeps `<app.getPath('temp')>/novafetch-update` (best-effort), so any leftover installer is removed when the app quits. The file already handed to the OS by `update:launch` is skipped so a running installer is never deleted out from under itself.
- Partial `.part`-style staging files are never created — the temp file is the single target path.

## Error Handling

| Failure | Where | Behavior |
| --- | --- | --- |
| Empty `downloadUrl` | Renderer | Error toast; no download starts. |
| Invalid URL / non-http(s) | Main | `{ ok: false, error }`; toast in renderer. |
| Network failure / timeout | Main | Fetch rejects → partial file deleted → `{ ok: false }`. |
| HTTP error status | Main | `{ ok: false }` with HTTP status in the message. |
| File write error | Main | Pipeline rejects → partial file deleted → `{ ok: false }`. |
| Installer missing at launch | Main | `{ ok: false }`; app stays open. |
| Launch error | Main | `{ ok: false }` with shell error; app stays open. |

## Things Deliberately Not Changed

- Update checking (`update:check`, `UpdateService.checkForUpdates` logic).
- Version comparison (`versionCompare.ts`).
- Manifest parsing (`updateManifest.ts`).
- Update dialog layout.
- Any download manager logic.
