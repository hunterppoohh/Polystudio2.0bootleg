import * as THREE from "three";
import { state, camConfig } from "./state";
import type { CustomGizmo } from "./gizmo";

// References stored at module level, set by register functions called from main.ts
let _gizmo: CustomGizmo | null = null;
let _ambient: THREE.AmbientLight | null = null;
let _dirLight: THREE.DirectionalLight | null = null;
let _grid: THREE.GridHelper | null = null;

export function registerLights(a: THREE.AmbientLight, d: THREE.DirectionalLight): void {
  _ambient = a;
  _dirLight = d;
}

export function registerGrid(g: THREE.GridHelper): void {
  _grid = g;
}

export function initSettings(gizmo: CustomGizmo): void {
  _gizmo = gizmo;

  // --- Modal open/close ---
  const overlay = document.getElementById("settings-overlay") as HTMLElement;

  document.getElementById("btn-settings")!.addEventListener("click", () => {
    populateForm();
    overlay.classList.remove("hidden");
  });

  document.getElementById("settings-close")!.addEventListener("click", () => {
    overlay.classList.add("hidden");
  });

  // Click outside modal to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });

  // --- Tab switching ---
  document.querySelectorAll<HTMLElement>(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".settings-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab)!.classList.add("active");
    });
  });

  // --- Live range labels ---
  liveLabel("set-gizmo-size", "set-gizmo-size-val", v => v.toFixed(2));
  liveLabel("set-cam-speed", "set-cam-speed-val", v => v.toFixed(2));
  liveLabel("set-cam-slow", "set-cam-slow-val", v => v.toFixed(2));
  liveLabel("set-cam-sens", "set-cam-sens-val", v => v.toFixed(4));
  liveLabel("set-cam-fov", "set-cam-fov-val", v => Math.round(v) + "°");
  liveLabel("set-ambient", "set-ambient-val", v => v.toFixed(2));
  liveLabel("set-sun", "set-sun-val", v => v.toFixed(2));
  liveLabel("set-grid-size", "set-grid-size-val", v => Math.round(v).toString());
  liveLabel("set-grid-divs", "set-grid-divs-val", v => Math.round(v).toString());

  // --- Apply ---
  document.getElementById("settings-apply")!.addEventListener("click", () => {
    applyAll();
    overlay.classList.add("hidden");
  });

  // --- Reset ---
  document.getElementById("settings-reset")!.addEventListener("click", () => {
    setDefaults();
    applyAll();
  });
}

// Populate form with current live values every time panel opens
function populateForm(): void {
  if (!_gizmo) return;
  val("set-gizmo-size", _gizmo.sizeScale);
  val("set-color-x", toHex(_gizmo.colors.X));
  val("set-color-y", toHex(_gizmo.colors.Y));
  val("set-color-z", toHex(_gizmo.colors.Z));
  val("set-color-highlight", toHex(_gizmo.highlightColor));
  val("set-snap-move", numInput("snap-move"));
  val("set-snap-rotate", numInput("snap-rotate"));
  val("set-cam-speed", camConfig.speedNormal);
  val("set-cam-slow", camConfig.speedSlow);
  val("set-cam-sens", camConfig.sensitivity);
  val("set-cam-fov", state.camera ? state.camera.fov : 60);
  val("set-bg-color", state.scene ? toHex((state.scene.background as THREE.Color).getHex()) : "#151515");
  chk("set-show-overlay", (document.getElementById("gizmo-overlay") as HTMLElement).style.display !== "none");
  val("set-ambient", _ambient ? _ambient.intensity : 0.7);
  val("set-sun", _dirLight ? _dirLight.intensity : 0.8);
  chk("set-show-grid", _grid ? _grid.visible : true);
  // Trigger label refreshes
  ["set-gizmo-size","set-cam-speed","set-cam-slow","set-cam-sens","set-cam-fov","set-ambient","set-sun","set-grid-size","set-grid-divs"]
    .forEach(id => inp(id).dispatchEvent(new Event("input")));
}

function applyAll(): void {
  if (!_gizmo) return;

  // Gizmo
  _gizmo.sizeScale = num("set-gizmo-size");
  _gizmo.colors.X = fromHex(str("set-color-x"));
  _gizmo.colors.Y = fromHex(str("set-color-y"));
  _gizmo.colors.Z = fromHex(str("set-color-z"));
  _gizmo.highlightColor = fromHex(str("set-color-highlight"));
  _gizmo.rebuildColors();

  // Snapping - sync back to toolbar inputs too
  const snapMv = num("set-snap-move");
  const snapRot = num("set-snap-rotate");
  inp("snap-move").value = String(snapMv);
  inp("snap-rotate").value = String(snapRot);
  _gizmo.setTranslationSnap(snapMv > 0 ? snapMv : null);
  _gizmo.setScaleSnap(snapMv > 0 ? snapMv : null);
  _gizmo.setRotationSnap(snapRot > 0 ? THREE.MathUtils.degToRad(snapRot) : null);

  // Camera
  camConfig.speedNormal = num("set-cam-speed");
  camConfig.speedSlow = num("set-cam-slow");
  camConfig.sensitivity = num("set-cam-sens");
  if (state.camera) {
    state.camera.fov = num("set-cam-fov");
    state.camera.updateProjectionMatrix();
  }

  // Viewport
  if (state.scene) {
    state.scene.background = new THREE.Color(str("set-bg-color"));
  }
  const overlay = document.getElementById("gizmo-overlay") as HTMLElement;
  overlay.style.display = chkVal("set-show-overlay") ? "" : "none";

  if (_ambient) _ambient.intensity = num("set-ambient");
  if (_dirLight) _dirLight.intensity = num("set-sun");

  // Grid
  if (state.scene && _grid) {
    state.scene.remove(_grid);
    (_grid.geometry as THREE.BufferGeometry).dispose();
    _grid = new THREE.GridHelper(
      num("set-grid-size"),
      Math.max(1, Math.round(num("set-grid-divs"))),
      new THREE.Color(str("set-grid-center")),
      new THREE.Color(str("set-grid-line")),
    );
    _grid.visible = chkVal("set-show-grid");
    state.scene.add(_grid);
  }
}

function setDefaults(): void {
  val("set-gizmo-size", 0.15);
  val("set-color-x", "#ff3333");
  val("set-color-y", "#33ff33");
  val("set-color-z", "#3399ff");
  val("set-color-highlight", "#ffff00");
  val("set-snap-move", 1);
  val("set-snap-rotate", 45);
  val("set-cam-speed", 0.5);
  val("set-cam-slow", 0.1);
  val("set-cam-sens", 0.002);
  val("set-cam-fov", 60);
  val("set-bg-color", "#151515");
  chk("set-show-overlay", true);
  val("set-ambient", 0.7);
  val("set-sun", 0.8);
  chk("set-show-grid", true);
  val("set-grid-size", 500);
  val("set-grid-divs", 100);
  val("set-grid-center", "#444444");
  val("set-grid-line", "#222222");
  ["set-gizmo-size","set-cam-speed","set-cam-slow","set-cam-sens","set-cam-fov","set-ambient","set-sun","set-grid-size","set-grid-divs"]
    .forEach(id => inp(id).dispatchEvent(new Event("input")));
}

// ---- Tiny helpers ----
function inp(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}
function val(id: string, v: number | string): void {
  inp(id).value = String(v);
}
function chk(id: string, v: boolean): void {
  inp(id).checked = v;
}
function num(id: string): number {
  return parseFloat(inp(id).value) || 0;
}
function str(id: string): string {
  return inp(id).value;
}
function chkVal(id: string): boolean {
  return inp(id).checked;
}
function numInput(id: string): number {
  return parseFloat(inp(id).value) || 0;
}
function toHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
function fromHex(s: string): number {
  return parseInt(s.replace("#", ""), 16);
}
function liveLabel(inputId: string, labelId: string, fmt: (v: number) => string): void {
  const el = inp(inputId);
  const lbl = document.getElementById(labelId)!;
  const update = () => { lbl.textContent = fmt(parseFloat(el.value)); };
  el.addEventListener("input", update);
  update();
}
