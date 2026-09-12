"use strict";
const keys = ["trackerData", "recurringSupps", "recurringGym", "appSettings", "activeFast"];
const status = document.getElementById("status");
const rawButton = document.getElementById("export-raw");
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function read() {
  return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
}
document.getElementById("export-legacy").onclick = () => {
  try {
    const raw = read();
    if (Object.values(raw).every(value => value === null)) {
      status.textContent = "No tracker data was found in this browser profile. Try the browser where you used the old tracker.";
      return;
    }
    const data = {};
    const invalid = [];
    for (const key of keys) {
      try {
        data[key] = raw[key] === null ? (key === "activeFast" ? null : {}) : JSON.parse(raw[key]);
        if ((data[key] === null && key !== "activeFast") || (data[key] !== null && (typeof data[key] !== "object" || Array.isArray(data[key])))) throw new Error("Unexpected data");
      } catch { invalid.push(key); }
    }
    if (invalid.length) {
      rawButton.hidden = false;
      status.textContent = `Some saved data cannot be exported normally (${invalid.join(", ")}). Download a raw recovery copy and contact the operator for help. Nothing has been changed. The recovery copy is not directly importable.`;
      return;
    }
    download({ format: "spartacus-legacy", version: 1, exportedAt: new Date().toISOString(), data }, "spartacus-legacy.json");
    status.textContent = "Export downloaded. Your browser data has not been changed.";
  } catch {
    status.textContent = "Browser storage could not be read. Allow access to site storage and retry. Nothing has been changed.";
  }
};
rawButton.onclick = () => {
  try {
    download({ format: "spartacus-legacy-recovery", version: 1, exportedAt: new Date().toISOString(), raw: read() }, "spartacus-legacy-recovery.json");
    status.textContent = "Raw recovery copy downloaded. Your browser data has not been changed.";
  } catch { status.textContent = "Browser storage could not be read. Nothing has been changed."; }
};
