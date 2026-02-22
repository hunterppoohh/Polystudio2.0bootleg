import * as THREE from "three";
import { state } from "./state";
import { createPolyObject } from "./factory";
import { refreshTree, refreshExplorerTree, selectObject, updatePropertiesUI } from "./ui";
import type { PropData, PropConfig, PolyUserData } from "./types";

export function addObject(): void {
  const typeInput = document.getElementById("add-type") as HTMLInputElement;
  const typeVal = typeInput.value;
  const isFolder = typeVal === "Folder";
  const isScript = typeVal === "Script" || typeVal === "LocalScript";

  const defaultProps: PropData = {
    Name: isFolder ? "Folder" : isScript ? typeVal : "Part",
    Anchored: true, CanCollide: true,
    Position: { x: 0, y: 0, z: 0 }, Rotation: { x: 0, y: 0, z: 0 },
    Size: { x: 1, y: 1, z: 1 }, Color: { r: 0.63, g: 0.63, b: 0.63, a: 1 },
  };
  const defaultConfig: PropConfig = {
    Name: "string", Anchored: "boolean", CanCollide: "boolean",
    Position: "vector3", Rotation: "vector3", Size: "vector3", Color: "color",
  };

  let className = "Part";
  if (isFolder) className = "Folder";
  else if (isScript) className = typeVal;
  else {
    const id = parseInt(typeVal);
    defaultProps.Shape = id;
    defaultConfig.Shape = "int";
    const names = ["Brick", "Sphere", "Cylinder", "Wedge", "Truss"];
    defaultProps.Name = names[id] || "Part";
  }

  const mesh = createPolyObject(className, defaultProps, defaultConfig);

  if (!isScript && mesh.type !== "Group") {
    const spawn = new THREE.Vector3();
    state.camera.getWorldDirection(spawn);
    mesh.position.copy(state.camera.position).add(spawn.multiplyScalar(5));
    const pos = defaultProps.Position as { x: number; y: number; z: number };
    pos.x = mesh.position.x; pos.y = mesh.position.y; pos.z = mesh.position.z;
    state.objects.push(mesh);
  }

  if (state.selectedObject && (state.selectedObject.userData as PolyUserData).className === "Folder") {
    state.selectedObject.add(mesh);
  } else {
    state.scene.add(mesh);
  }

  refreshTree(); refreshExplorerTree();
  selectObject(mesh);
}

export function deleteSelected(): void {
  if (!state.selectedObject) return;
  const obj = state.selectedObject;
  state.transformControl.detach();
  obj.removeFromParent();
  const removeRecursive = (o: THREE.Object3D) => {
    state.objects = state.objects.filter((x) => x !== o);
    o.children.forEach((c) => removeRecursive(c));
  };
  removeRecursive(obj);
  state.selectedObject = null;
  refreshTree(); refreshExplorerTree();
  updatePropertiesUI();
}

export function copySelection(): void {
  if (!state.selectedObject) return;
  state.clipboard = state.selectedObject.clone();
  const mesh = state.selectedObject as THREE.Mesh;
  const clipMesh = state.clipboard as THREE.Mesh;
  if (mesh.isMesh && mesh.material) {
    if (Array.isArray(mesh.material)) clipMesh.material = mesh.material.map((m) => m.clone());
    else clipMesh.material = mesh.material.clone();
  }
}

export function pasteSelection(): void {
  if (!state.clipboard) return;
  const newObj = state.clipboard.clone();
  const clipMesh = state.clipboard as THREE.Mesh;
  const newMesh = newObj as THREE.Mesh;
  if (clipMesh.isMesh && clipMesh.material) {
    if (Array.isArray(clipMesh.material)) newMesh.material = clipMesh.material.map((m) => m.clone());
    else newMesh.material = clipMesh.material.clone();
  }
  newObj.position.add(new THREE.Vector3(1, 0, 1));
  newObj.name = state.clipboard.name + " (Copy)";
  state.scene.add(newObj); state.objects.push(newObj);
  refreshTree(); refreshExplorerTree();
  selectObject(newObj);
}

export function duplicateSelection(): void {
  if (!state.selectedObject) return;
  const newObj = state.selectedObject.clone();
  const selMesh = state.selectedObject as THREE.Mesh;
  const newMesh = newObj as THREE.Mesh;
  if (selMesh.isMesh && selMesh.material) {
    if (Array.isArray(selMesh.material)) newMesh.material = selMesh.material.map((m) => m.clone());
    else newMesh.material = selMesh.material.clone();
  }
  newObj.name = state.selectedObject.name + " (Dup)";
  state.scene.add(newObj); state.objects.push(newObj);
  refreshTree(); refreshExplorerTree();
  selectObject(newObj);
}
