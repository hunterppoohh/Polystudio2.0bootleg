import * as THREE from "three";
import type {
  PropData,
  PropConfig,
  PolyUserData,
  ColorData,
  Vector3Data,
} from "./types";

export function createPolyObject(
  className: string,
  propData: PropData = {},
  propConfig: PropConfig = {},
): THREE.Object3D {
  let obj3d: THREE.Object3D;

  if (["Part", "Truss", "Seat", "Wedge", "CornerWedge"].includes(className)) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    let geo: THREE.BufferGeometry;
    const shape =
      propData["Shape"] !== undefined ? (propData["Shape"] as number) : 0;

    if (shape === 1) geo = new THREE.SphereGeometry(0.5);
    else if (shape === 2) geo = new THREE.CylinderGeometry(0.5, 0.5, 1);
    else if (shape === 3) geo = new THREE.ConeGeometry(0.5, 1, 4);
    else geo = new THREE.BoxGeometry(1, 1, 1);

    obj3d = new THREE.Mesh(geo, mat);

    // Position
    if (propData.Position) {
      const pos = propData.Position as Vector3Data;
      obj3d.position.set(pos.x, pos.y, pos.z);
    }

    // Size (Scale)
    if (propData.Size) {
      const size = propData.Size as Vector3Data;
      obj3d.scale.set(size.x, size.y, size.z);
    }

    // Rotation
    if (propData.Rotation) {
      const rot = propData.Rotation as Vector3Data;
      obj3d.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z),
      );
    }

    // Apply Color
    if (propData.Color) {
      const col = propData.Color as ColorData;
      const mesh = obj3d as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;
      mesh.material.color.setRGB(col.r, col.g, col.b);
      mesh.material.opacity = col.a;
      if (col.a < 1) mesh.material.transparent = true;
    }
  } else {
    // Folders, etc.
    obj3d = new THREE.Group();
  }

  obj3d.name = (propData.Name as string) || className;

  // Assign typed userData
  const userData: PolyUserData = { className, props: propData, propConfig };
  obj3d.userData = userData;

  return obj3d;
}
