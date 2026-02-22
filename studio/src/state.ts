import type { AppState, CamInput, CamConfig } from "./types";

export const state: AppState = {
  scene: null!,
  camera: null!,
  renderer: null!,
  transformControl: null!,
  selectedObject: null,
  selectedObjects: [],
  objects: [],
  clipboard: null,
  dragSource: null,
  isDraggingGizmo: false,
  activeTool: "translate",
  paintColor: "#ff0000",
};

export const camInput: CamInput = {
  forward: false, backward: false, left: false, right: false,
  up: false, down: false, sprint: false, rotating: false,
};

export const camConfig: CamConfig = {
  speedNormal: 0.5, speedSlow: 0.1, sensitivity: 0.002,
};
