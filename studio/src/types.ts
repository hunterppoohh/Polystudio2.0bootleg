import * as THREE from "three";
import type { CustomGizmo } from "./gizmo";

export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

export interface ColorData {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type PropValue = string | number | boolean | Vector3Data | ColorData;

export interface PropConfig {
  [key: string]: string;
}

export interface PropData {
  [key: string]: PropValue;
}

export interface PolyUserData {
  className: string;
  props: PropData;
  propConfig: PropConfig;
  treeNode?: HTMLElement;
}

export interface AppState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  transformControl: CustomGizmo;
  selectedObject: THREE.Object3D | null;
  objects: THREE.Object3D[];
  clipboard: THREE.Object3D | null;
  dragSource: THREE.Object3D | null;
  isDraggingGizmo: boolean;
}

export interface CamInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  rotating: boolean;
}

export interface CamConfig {
  speedNormal: number;
  speedSlow: number;
  sensitivity: number;
}
