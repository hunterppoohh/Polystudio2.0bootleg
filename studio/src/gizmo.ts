import * as THREE from "three";

export type GizmoMode = "translate" | "rotate" | "scale";
type AxisKey = "X" | "Y" | "Z";
type GizmoAxis = AxisKey | null;

interface Handle { mesh: THREE.Mesh; axis: AxisKey; }

/** Roblox-style transform gizmo:
 *  - Translate: bold arrow shafts + cone tips + flat square plane handles
 *  - Rotate:    thick arc segments per axis, no free-rotate ring
 *  - Scale:     bold shaft + cube end-caps per axis
 */
export class CustomGizmo {
  mode: GizmoMode = "translate";
  axis: GizmoAxis = null;
  sizeScale = 0.15;
  colors: Record<AxisKey, number> = { X: 0xff3333, Y: 0x33ff33, Z: 0x3399ff };
  highlightColor = 0xffff00;

  private roots: Record<GizmoMode, THREE.Group>;
  private handles: Record<GizmoMode, Handle[]> = { translate: [], rotate: [], scale: [] };
  private activeRoot: THREE.Group;
  private target: THREE.Object3D | null = null;
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private scene: THREE.Scene;

  private dragging = false;
  private dragAxis: GizmoAxis = null;
  private dragStart = new THREE.Vector3();
  private targetStart = new THREE.Vector3();
  private scaleStart = new THREE.Vector3();
  private rotStartQuat = new THREE.Quaternion();
  private rotAngleStart = 0;
  private snapMove = 0;
  private snapRotDeg = 0;

  private arcVisuals: Record<AxisKey, THREE.Mesh | null> = { X: null, Y: null, Z: null };

  onDraggingChanged?: (val: boolean) => void;
  onChange?: () => void;

  constructor(camera: THREE.Camera, domElement: HTMLElement, scene: THREE.Scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
    this.roots = {
      translate: new THREE.Group(),
      rotate: new THREE.Group(),
      scale: new THREE.Group(),
    };
    this.buildTranslate();
    this.buildRotate();
    this.buildScale();
    for (const g of Object.values(this.roots)) { g.visible = false; scene.add(g); }
    this.activeRoot = this.roots.translate;
    domElement.addEventListener("mousemove", this.onMouseMove);
    domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  private mat(color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, depthTest: false, toneMapped: false });
  }

  private reg(group: THREE.Group, mesh: THREE.Mesh, axis: AxisKey, list: Handle[]): void {
    mesh.renderOrder = 999;
    group.add(mesh);
    list.push({ mesh, axis });
  }

  private buildTranslate(): void {
    const g = this.roots.translate;
    const h = this.handles.translate;
    const axes: [AxisKey, THREE.Vector3, THREE.Euler][] = [
      ["X", new THREE.Vector3(1, 0, 0), new THREE.Euler(0, 0, -Math.PI / 2)],
      ["Y", new THREE.Vector3(0, 1, 0), new THREE.Euler(0, 0, 0)],
      ["Z", new THREE.Vector3(0, 0, 1), new THREE.Euler(Math.PI / 2, 0, 0)],
    ];

    for (const [key, dir, rot] of axes) {
      const c = this.colors[key];
      // Bold shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 8), this.mat(c));
      shaft.position.copy(dir).multiplyScalar(0.5);
      shaft.rotation.copy(rot);
      this.reg(g, shaft, key, h);
      // Cone tip
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 8), this.mat(c));
      cone.position.copy(dir).multiplyScalar(1.19);
      cone.rotation.copy(rot);
      this.reg(g, cone, key, h);
      // Wide invisible hitbox
      const hitShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8),
        new THREE.MeshBasicMaterial({ visible: false, depthTest: false }),
      );
      hitShaft.position.copy(dir).multiplyScalar(0.7);
      hitShaft.rotation.copy(rot);
      hitShaft.renderOrder = 999;
      g.add(hitShaft);
      h.push({ mesh: hitShaft, axis: key });
    }

    // Plane handles (Roblox-style flat squares offset from center)
    const planeHandles: [AxisKey, THREE.Euler, THREE.Vector3][] = [
      ["Z", new THREE.Euler(0, 0, 0), new THREE.Vector3(0.33, 0.33, 0)],
      ["Y", new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(0.33, 0, 0.33)],
      ["X", new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(0, 0.33, 0.33)],
    ];
    for (const [key, rot, pos] of planeHandles) {
      const c = this.colors[key];
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.26),
        new THREE.MeshBasicMaterial({ color: c, depthTest: false, toneMapped: false, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      plane.position.copy(pos);
      plane.rotation.copy(rot);
      plane.renderOrder = 998;
      g.add(plane);
      const hitPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.26),
        new THREE.MeshBasicMaterial({ visible: false, depthTest: false, side: THREE.DoubleSide }),
      );
      hitPlane.position.copy(pos);
      hitPlane.rotation.copy(rot);
      hitPlane.renderOrder = 999;
      g.add(hitPlane);
      h.push({ mesh: hitPlane, axis: key });
    }
  }

  private buildRotate(): void {
    const g = this.roots.rotate;
    const h = this.handles.rotate;
    const arcAngle = (Math.PI * 3) / 2; // 270° arc, Roblox-style

    const axes: [AxisKey, THREE.Euler][] = [
      ["X", new THREE.Euler(0, Math.PI / 2, 0)],
      ["Y", new THREE.Euler(-Math.PI / 2, 0, 0)],
      ["Z", new THREE.Euler(0, 0, 0)],
    ];

    for (const [key, rot] of axes) {
      const c = this.colors[key];
      const arcGeo = new THREE.TorusGeometry(0.9, 0.05, 8, 64, arcAngle);
      const arc = new THREE.Mesh(arcGeo, this.mat(c));
      arc.rotation.copy(rot);
      arc.renderOrder = 999;
      g.add(arc);
      this.arcVisuals[key] = arc;

      // Invisible full-ring hitbox
      const hitMat = new THREE.MeshBasicMaterial({ visible: false, depthTest: false, side: THREE.DoubleSide });
      const hitbox = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.25, 6, 32), hitMat);
      hitbox.renderOrder = 999;
      hitbox.rotation.copy(rot);
      g.add(hitbox);
      h.push({ mesh: hitbox, axis: key });
    }

    // Subtle filled discs
    const discAxes: [AxisKey, THREE.Euler][] = [
      ["X", new THREE.Euler(0, Math.PI / 2, 0)],
      ["Y", new THREE.Euler(-Math.PI / 2, 0, 0)],
      ["Z", new THREE.Euler(0, 0, 0)],
    ];
    for (const [key, rot] of discAxes) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.85, 32),
        new THREE.MeshBasicMaterial({ color: this.colors[key], depthTest: false, transparent: true, opacity: 0.05, side: THREE.DoubleSide }),
      );
      disc.rotation.copy(rot);
      disc.renderOrder = 997;
      g.add(disc);
    }
  }

  private buildScale(): void {
    const g = this.roots.scale;
    const h = this.handles.scale;
    const axes: [AxisKey, THREE.Vector3, THREE.Euler][] = [
      ["X", new THREE.Vector3(1, 0, 0), new THREE.Euler(0, 0, -Math.PI / 2)],
      ["Y", new THREE.Vector3(0, 1, 0), new THREE.Euler(0, 0, 0)],
      ["Z", new THREE.Vector3(0, 0, 1), new THREE.Euler(Math.PI / 2, 0, 0)],
    ];
    for (const [key, dir, rot] of axes) {
      const c = this.colors[key];
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 8), this.mat(c));
      shaft.position.copy(dir).multiplyScalar(0.5);
      shaft.rotation.copy(rot);
      this.reg(g, shaft, key, h);
      // Cube end-cap
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), this.mat(c));
      cube.position.copy(dir).multiplyScalar(1.12);
      this.reg(g, cube, key, h);
      // Wide invisible hitbox
      const hitShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 1.35, 8),
        new THREE.MeshBasicMaterial({ visible: false, depthTest: false }),
      );
      hitShaft.position.copy(dir).multiplyScalar(0.67);
      hitShaft.rotation.copy(rot);
      hitShaft.renderOrder = 999;
      g.add(hitShaft);
      h.push({ mesh: hitShaft, axis: key });
    }
    // Center sphere for uniform scale indication
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), this.mat(0xaaaaaa));
    center.renderOrder = 999;
    g.add(center);
  }

  rebuildColors(): void {
    for (const mode of (["translate", "rotate", "scale"] as GizmoMode[])) {
      for (const h of this.handles[mode]) {
        const mat = h.mesh.material as THREE.MeshBasicMaterial;
        if (mat.visible !== false) mat.color.setHex(this.colors[h.axis]);
      }
    }
    for (const key of (["X", "Y", "Z"] as AxisKey[])) {
      const arc = this.arcVisuals[key];
      if (arc) (arc.material as THREE.MeshBasicMaterial).color.setHex(this.colors[key]);
    }
  }

  setMode(mode: GizmoMode): void {
    this.activeRoot.visible = false;
    this.mode = mode;
    this.activeRoot = this.roots[mode];
    if (this.target) this.activeRoot.visible = true;
  }

  setTranslationSnap(v: number | null): void { this.snapMove = v ?? 0; }
  setScaleSnap(v: number | null): void { this.snapMove = v ?? 0; }
  setRotationSnap(v: number | null): void { this.snapRotDeg = v ? THREE.MathUtils.radToDeg(v) : 0; }

  attach(obj: THREE.Object3D): void { this.target = obj; this.activeRoot.visible = true; this.updatePosition(); }
  detach(): void { this.target = null; for (const g of Object.values(this.roots)) g.visible = false; this.axis = null; }

  updatePosition(): void {
    if (!this.target) return;
    const wp = new THREE.Vector3();
    this.target.getWorldPosition(wp);
    const s = this.camera.position.distanceTo(wp) * this.sizeScale;
    for (const g of Object.values(this.roots)) { g.position.copy(wp); g.scale.setScalar(s); }
  }

  private get currentHandles(): Handle[] { return this.handles[this.mode]; }

  private ndc(e: MouseEvent): THREE.Vector2 {
    const r = this.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private raycast(e: MouseEvent): Handle | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(e), this.camera);
    const hits = ray.intersectObjects(this.currentHandles.map(h => h.mesh), false);
    if (!hits.length) return null;
    return this.currentHandles.find(h => h.mesh === hits[0].object) ?? null;
  }

  private getPlaneHit(e: MouseEvent, axis: AxisKey): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(e), this.camera);
    const cd = new THREE.Vector3(); this.camera.getWorldDirection(cd);
    let norm: THREE.Vector3;
    if (axis === "X") norm = Math.abs(cd.y) > Math.abs(cd.z) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    else if (axis === "Y") norm = Math.abs(cd.x) > Math.abs(cd.z) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    else norm = Math.abs(cd.y) > Math.abs(cd.x) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(norm, this.activeRoot.position);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }

  private getRotAngle(e: MouseEvent, axis: AxisKey): number | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(e), this.camera);
    const norm = axis === "X" ? new THREE.Vector3(1, 0, 0)
      : axis === "Y" ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(norm, this.activeRoot.position);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const local = hit.clone().sub(this.activeRoot.position);
    if (axis === "X") return Math.atan2(local.y, local.z);
    if (axis === "Y") return Math.atan2(local.z, local.x);
    return Math.atan2(local.x, local.y);
  }

  private highlight(active: Handle | null): void {
    for (const h of this.currentHandles) {
      const mat = h.mesh.material as THREE.MeshBasicMaterial;
      if (mat.visible === false) continue;
      mat.color.setHex(h === active ? this.highlightColor : this.colors[h.axis]);
    }
    if (this.mode === "rotate") {
      for (const key of (["X", "Y", "Z"] as AxisKey[])) {
        const arc = this.arcVisuals[key];
        if (arc) {
          (arc.material as THREE.MeshBasicMaterial).color.setHex(
            (active && active.axis === key) ? this.highlightColor : this.colors[key]
          );
        }
      }
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.target) return;
    this.updatePosition();

    if (this.dragging && this.dragAxis) {
      if (this.mode === "rotate") {
        const angle = this.getRotAngle(e, this.dragAxis);
        if (angle === null) return;
        let delta = angle - this.rotAngleStart;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (this.snapRotDeg > 0) delta = Math.round(delta / THREE.MathUtils.degToRad(this.snapRotDeg)) * THREE.MathUtils.degToRad(this.snapRotDeg);
        const rotAxis = this.dragAxis === "X" ? new THREE.Vector3(1, 0, 0)
          : this.dragAxis === "Y" ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(rotAxis, delta);
        this.target!.quaternion.copy(this.rotStartQuat).multiply(deltaQ);
      } else {
        const hit = this.getPlaneHit(e, this.dragAxis);
        if (!hit) return;
        const delta = hit.clone().sub(this.dragStart);
        const ax = this.dragAxis === "X" ? new THREE.Vector3(1, 0, 0) : this.dragAxis === "Y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        if (this.mode === "translate") {
          let val = (this.dragAxis === "X" ? this.targetStart.x : this.dragAxis === "Y" ? this.targetStart.y : this.targetStart.z) + delta.dot(ax);
          if (this.snapMove > 0) val = Math.round(val / this.snapMove) * this.snapMove;
          if (this.dragAxis === "X") this.target!.position.x = val;
          else if (this.dragAxis === "Y") this.target!.position.y = val;
          else this.target!.position.z = val;
        } else if (this.mode === "scale") {
          let val = (this.dragAxis === "X" ? this.scaleStart.x : this.dragAxis === "Y" ? this.scaleStart.y : this.scaleStart.z) + delta.dot(ax);
          val = Math.max(0.01, val);
          if (this.snapMove > 0) val = Math.max(this.snapMove, Math.round(val / this.snapMove) * this.snapMove);
          if (this.dragAxis === "X") this.target!.scale.x = val;
          else if (this.dragAxis === "Y") this.target!.scale.y = val;
          else this.target!.scale.z = val;
        }
      }
      this.onChange?.();
      return;
    }

    const hit = this.raycast(e);
    this.axis = hit?.axis ?? null;
    this.highlight(hit ?? null);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0 || !this.target) return;
    const hit = this.raycast(e);
    if (!hit) return;
    e.stopPropagation();
    this.dragging = true;
    this.dragAxis = hit.axis;
    this.onDraggingChanged?.(true);
    if (this.mode === "rotate") {
      const a = this.getRotAngle(e, this.dragAxis!);
      this.rotAngleStart = a ?? 0;
    } else {
      const ph = this.getPlaneHit(e, this.dragAxis!);
      if (ph) this.dragStart.copy(ph);
    }
    this.targetStart.copy(this.target.position);
    this.scaleStart.copy(this.target.scale);
    this.rotStartQuat.copy(this.target.quaternion);
  };

  private onMouseUp = (): void => {
    if (this.dragging) { this.dragging = false; this.dragAxis = null; this.onDraggingChanged?.(false); }
  };

  dispose(): void {
    this.domElement.removeEventListener("mousemove", this.onMouseMove);
    this.domElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    for (const g of Object.values(this.roots)) this.scene.remove(g);
  }
}
