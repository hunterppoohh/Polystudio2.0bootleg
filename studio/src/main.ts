import "./style.css";
import * as THREE from "three";
import { CustomGizmo } from "./gizmo";
import { state, camInput, camConfig } from "./state";
import { loadFile, saveFile } from "./io";
import { addObject, deleteSelected, copySelection, pasteSelection, duplicateSelection } from "./commands";
import { selectObject, selectMultiple, deselect, syncTransformsToProps, updatePropertiesUI, refreshTree, refreshExplorerTree } from "./ui";
import { initSettings, registerLights, registerGrid } from "./settings";
import { initGUIEditor, addGUIElement, removeGUIElement, getSelectedGUIElement, GUI_CLASSES } from "./gui-editor";

let boxSelecting = false;
let boxStart = { x: 0, y: 0 };
let boxEl: HTMLElement | null = null;
let editorMode: "3d" | "gui" = "3d";
let guiZoom = 1.0;

const GUI_ASPECT_PRESETS: Record<string, [number, number]> = {
  "1920x1080": [1920, 1080], "1280x720": [1280, 720],
  "1080x1920": [1080, 1920], "800x600":  [800, 600],
};

function init(): void {
  const viewport = document.getElementById("viewport-wrapper")!;

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x151515);

  const grid = new THREE.GridHelper(500, 100, 0x444444, 0x222222);
  state.scene.add(grid);
  registerGrid(grid);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  state.scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 100, 50);
  state.scene.add(dirLight);
  registerLights(ambient, dirLight);

  state.camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
  state.camera.position.set(10, 10, 10);
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  viewport.appendChild(state.renderer.domElement);

  state.transformControl = new CustomGizmo(state.camera, state.renderer.domElement, state.scene);
  state.transformControl.onDraggingChanged = (val) => {
    state.isDraggingGizmo = val;
    if (val) camInput.rotating = false;
  };
  state.transformControl.onChange = () => {
    if (state.selectedObject) { syncTransformsToProps(state.selectedObject); updatePropertiesUI(); }
  };

  initGUIEditor({
    panel:  document.getElementById("gui-editor-wrapper")!,
    canvas: document.getElementById("gui-canvas")!,
    tree:   document.getElementById("gui-tree-view")!,
    props:  document.getElementById("gui-prop-content")!,
    onChange: () => {},
  });

  setupMenuBar();
  setupToolbar();
  setupGUIToolbar();
  setupSnapping();
  setupEvents();
  setupPanelResize();
  initSettings(state.transformControl);
  setActiveTool("select");
  setStatus("Ready");
  animate();
}

// ══════ MENU BAR ══════════════════════════════════════════════
function setupMenuBar(): void {
  const menus = ["file","edit","insert","model","tools"];
  menus.forEach(m => {
    const btn  = document.getElementById("menu-" + m)!;
    const drop = document.getElementById("dropdown-" + m);
    if (!btn || !drop) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = drop.classList.contains("visible");
      closeAllMenus();
      if (!isOpen) {
        const r = btn.getBoundingClientRect();
        drop.style.left = r.left + "px";
        drop.style.top  = r.bottom + "px";
        drop.classList.add("visible");
        btn.classList.add("active");
      }
    });
  });

  document.addEventListener("click", closeAllMenus);

  // File menu actions
  document.getElementById("menu-open")?.addEventListener("click", () => {
    (document.getElementById("file-input") as HTMLElement).click();
  });
  document.getElementById("menu-save")?.addEventListener("click", saveFile);
  document.getElementById("menu-saveas")?.addEventListener("click", saveFile);

  // Edit menu actions
  document.getElementById("menu-copy")?.addEventListener("click", copySelection);
  document.getElementById("menu-paste")?.addEventListener("click", pasteSelection);
  document.getElementById("menu-duplicate")?.addEventListener("click", duplicateSelection);
  document.getElementById("menu-delete")?.addEventListener("click", deleteSelected);

  // Insert menu actions — set add-type and call addObject
  const insertMap: Record<string, string> = {
    "mi-brick": "0", "mi-sphere": "1", "mi-cylinder": "2", "mi-wedge": "3",
    "mi-folder": "Folder", "mi-script": "Script", "mi-localscript": "LocalScript",
  };
  for (const [id, val] of Object.entries(insertMap)) {
    document.getElementById(id)?.addEventListener("click", () => {
      (document.getElementById("add-type") as HTMLSelectElement).value = val;
      addObject();
    });
  }

  // Model/Tools → Settings
  document.getElementById("menu-settings")?.addEventListener("click", () => {
    document.getElementById("settings-overlay")!.classList.remove("hidden");
  });
  document.getElementById("menu-settings2")?.addEventListener("click", () => {
    document.getElementById("settings-overlay")!.classList.remove("hidden");
  });
}

function closeAllMenus(): void {
  document.querySelectorAll(".dropdown-menu").forEach(d => d.classList.remove("visible"));
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));
}

// ══════ TOOLBAR ═══════════════════════════════════════════════
function setupToolbar(): void {
  // File input
  document.getElementById("file-input")!.onchange = (e) => loadFile(e);

  // Transform tools
  document.getElementById("tool-select")!.onclick = () => setActiveTool("select");
  document.getElementById("tool-move")!.onclick   = () => setActiveTool("translate");
  document.getElementById("tool-scale")!.onclick  = () => setActiveTool("scale");
  document.getElementById("tool-rotate")!.onclick = () => setActiveTool("rotate");
  document.getElementById("tool-paint")!.onclick  = () => setActiveTool("paint");

  document.getElementById("paint-color")?.addEventListener("input", (e) => {
    state.paintColor = (e.target as HTMLInputElement).value;
  });

  // Part button — insert Brick
  document.getElementById("btn-add")!.onclick = () => {
    (document.getElementById("add-type") as HTMLSelectElement).value = "0";
    addObject();
  };
  // Script button
  document.getElementById("btn-script")!.onclick = () => {
    (document.getElementById("add-type") as HTMLSelectElement).value = "Script";
    addObject();
  };

  // Settings
  document.getElementById("btn-settings")!.onclick = () => {
    document.getElementById("settings-overlay")!.classList.remove("hidden");
  };

  // Mode toggle
  document.getElementById("btn-mode-3d")!.onclick  = () => setEditorMode("3d");
  document.getElementById("btn-mode-gui")!.onclick = () => setEditorMode("gui");

  // Keyboard delete shortcut wired in onKeyDown
}

// ══════ GUI TOOLBAR ═══════════════════════════════════════════
function setupGUIToolbar(): void {
  document.getElementById("btn-gui-add")!.onclick = () => {
    const sel = (document.getElementById("gui-add-type") as HTMLSelectElement).value;
    addGUIElement(sel);
  };
  document.getElementById("btn-gui-delete")!.onclick = () => {
    const el = getSelectedGUIElement();
    if (el) removeGUIElement(el);
  };
  document.getElementById("gui-aspect")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value;
    const [w, h] = GUI_ASPECT_PRESETS[val] ?? [1920, 1080];
    applyGUICanvasSize(w, h);
  });
  applyGUICanvasSize(1920, 1080);
  document.getElementById("gui-zoom-in")!.onclick  = () => { guiZoom = Math.min(guiZoom + 0.1, 2.0); applyGUIZoom(); };
  document.getElementById("gui-zoom-out")!.onclick = () => { guiZoom = Math.max(guiZoom - 0.1, 0.2); applyGUIZoom(); };
  applyGUIZoom();
}

function applyGUICanvasSize(w: number, h: number): void {
  const canvas = document.getElementById("gui-canvas")!;
  const maxW = 1200;
  const scale = Math.min(1, maxW / w);
  canvas.style.width  = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  applyGUIZoom();
}
function applyGUIZoom(): void {
  const wrapper = document.getElementById("gui-canvas-wrapper")!;
  wrapper.style.transform = `scale(${guiZoom})`;
  const label = document.getElementById("gui-zoom-label");
  if (label) label.textContent = `${Math.round(guiZoom * 100)}%`;
}

// ══════ EDITOR MODE SWITCH ════════════════════════════════════
function setEditorMode(m: "3d" | "gui"): void {
  editorMode = m;
  const viewport   = document.getElementById("viewport-wrapper")!;
  const guiEditor  = document.getElementById("gui-editor-wrapper")!;
  const guiTools   = document.getElementById("gui-tools-bar")!;
  const treeView   = document.getElementById("tree-view")!;
  const guiTree    = document.getElementById("gui-tree-view")!;
  const propCnt    = document.getElementById("prop-content")!;
  const guiProp    = document.getElementById("gui-prop-content")!;
  const tabGame    = document.getElementById("tab-game")!;
  const tabGui     = document.getElementById("tab-gui")!;
  const btn3d      = document.getElementById("btn-mode-3d")!;
  const btnGui     = document.getElementById("btn-mode-gui")!;

  if (m === "3d") {
    viewport.style.display  = "flex";  guiEditor.style.display = "none";
    guiTools.style.display  = "none";
    treeView.style.display  = "block"; guiTree.style.display   = "none";
    propCnt.style.display   = "block"; guiProp.style.display   = "none";
    tabGame.style.display   = "";      tabGui.style.display    = "none";
    tabGame.classList.add("active");   tabGui.classList.remove("active");
    btn3d.classList.add("active");     btnGui.classList.remove("active");
  } else {
    viewport.style.display  = "none";  guiEditor.style.display = "flex";
    guiTools.style.display  = "flex";
    treeView.style.display  = "none";  guiTree.style.display   = "block";
    propCnt.style.display   = "none";  guiProp.style.display   = "block";
    tabGame.style.display   = "none";  tabGui.style.display    = "";
    tabGame.classList.remove("active"); tabGui.classList.add("active");
    btnGui.classList.add("active");    btn3d.classList.remove("active");
  }
}

// ══════ SNAPPING ══════════════════════════════════════════════
function setupSnapping(): void {
  const update = () => {
    const mvChk = (document.getElementById("snap-move-chk") as HTMLInputElement).checked;
    const rtChk = (document.getElementById("snap-rotate-chk") as HTMLInputElement).checked;
    const mv  = parseFloat((document.getElementById("snap-move")   as HTMLInputElement).value) || 0;
    const rot = parseFloat((document.getElementById("snap-rotate") as HTMLInputElement).value) || 0;
    state.transformControl.setTranslationSnap(mvChk && mv  > 0 ? mv  : null);
    state.transformControl.setScaleSnap(      mvChk && mv  > 0 ? mv  : null);
    state.transformControl.setRotationSnap(   rtChk && rot > 0 ? THREE.MathUtils.degToRad(rot) : null);
  };
  ["snap-move","snap-rotate","snap-move-chk","snap-rotate-chk"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", update);
  });
  update();
}

// ══════ PANEL RESIZE (explorer / properties) ══════════════════
function setupPanelResize(): void {
  const handle = document.getElementById("panel-resize-handle")!;
  const explorerSection   = document.getElementById("explorer-section")!;
  let resizing = false;
  let startY = 0;
  let startH = 0;
  handle.addEventListener("mousedown", (e) => {
    resizing = true; startY = e.clientY;
    startH = explorerSection.getBoundingClientRect().height;
    document.body.style.cursor = "row-resize";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const newH = Math.max(80, Math.min(startH + (e.clientY - startY), window.innerHeight * 0.75));
    explorerSection.style.maxHeight = newH + "px";
  });
  window.addEventListener("mouseup", () => {
    if (resizing) { resizing = false; document.body.style.cursor = ""; }
  });
}

// ══════ STATUS BAR ════════════════════════════════════════════
export function setStatus(msg: string): void {
  const el = document.getElementById("status-msg");
  if (el) el.textContent = msg;
}

// ══════ EVENTS ════════════════════════════════════════════════
function setupEvents(): void {
  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup",   onKeyUp);
  const canvas = state.renderer.domElement;
  canvas.addEventListener("mousedown",    onMouseDown);
  canvas.addEventListener("mouseup",      onMouseUp);
  canvas.addEventListener("mousemove",    onMouseMove);
  canvas.addEventListener("contextmenu",  (e) => e.preventDefault());
}

// ══════ ANIMATE ═══════════════════════════════════════════════
function animate(): void {
  requestAnimationFrame(animate);
  if (editorMode === "3d") {
    updateCamera();
    if (!state.isDraggingGizmo) state.transformControl.updatePosition();
    state.renderer.render(state.scene, state.camera);
  }
}

function updateCamera(): void {
  const speed = camInput.sprint ? camConfig.speedSlow : camConfig.speedNormal;
  const label = document.getElementById("speed-label");
  if (label) label.innerText = camInput.sprint ? "Speed: Precision" : "Speed: Normal";
  const dir   = new THREE.Vector3(); state.camera.getWorldDirection(dir);
  const right = new THREE.Vector3().crossVectors(dir, state.camera.up);
  if (camInput.forward)  state.camera.position.addScaledVector(dir,   speed);
  if (camInput.backward) state.camera.position.addScaledVector(dir,  -speed);
  if (camInput.right)    state.camera.position.addScaledVector(right,  speed);
  if (camInput.left)     state.camera.position.addScaledVector(right, -speed);
  if (camInput.up)       state.camera.position.y += speed;
  if (camInput.down)     state.camera.position.y -= speed;
}

// ══════ ACTIVE TOOL ═══════════════════════════════════════════
function setActiveTool(mode: string): void {
  state.activeTool = mode;
  const isTransform = mode === "translate" || mode === "rotate" || mode === "scale";
  if (isTransform) {
    state.transformControl.setMode(mode as "translate" | "rotate" | "scale");
    if (state.selectedObject) state.transformControl.attach(state.selectedObject);
  } else {
    state.transformControl.detach();
  }

  const labels: Record<string,string> = { select:"Select", translate:"Move", rotate:"Rotate", scale:"Scale", paint:"Paint" };
  const toolLabel = document.getElementById("tool-label");
  if (toolLabel) toolLabel.innerText = "Tool: " + (labels[mode] ?? mode);

  const btnMap: Record<string,string> = { select:"tool-select", translate:"tool-move", rotate:"tool-rotate", scale:"tool-scale", paint:"tool-paint" };
  Object.values(btnMap).forEach(id => document.getElementById(id)?.classList.remove("active"));
  document.getElementById(btnMap[mode])?.classList.add("active");

  const pw = document.getElementById("paint-color-wrap");
  if (pw) pw.style.display = mode === "paint" ? "flex" : "none";
  state.renderer.domElement.style.cursor = mode === "paint" ? "crosshair" : "default";
}

// ══════ MOUSE HANDLERS ════════════════════════════════════════
function getNDC(e: MouseEvent): THREE.Vector2 {
  const r = state.renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - r.left) / r.width)  * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1,
  );
}

function raycastObjects(e: MouseEvent): THREE.Object3D | null {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(getNDC(e), state.camera);
  const hits = ray.intersectObjects(state.objects, false);
  return hits.length > 0 ? hits[0].object : null;
}

function onMouseDown(e: MouseEvent): void {
  if (editorMode !== "3d") return;
  if (state.isDraggingGizmo) return;

  if (e.button === 2) {
    if (!state.transformControl.axis) { camInput.rotating = true; document.body.style.cursor = "grab"; }
    return;
  }
  if (e.button !== 0) return;

  if (state.activeTool === "paint") {
    const hit = raycastObjects(e); if (hit) applyPaint(hit); return;
  }
  if (state.activeTool === "select") {
    const rect = state.renderer.domElement.getBoundingClientRect();
    boxStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    boxSelecting = true;
    if (!boxEl) {
      boxEl = document.createElement("div");
      boxEl.id = "box-select";
      document.getElementById("viewport-wrapper")!.appendChild(boxEl);
    }
    boxEl.style.cssText = `display:block;left:${boxStart.x}px;top:${boxStart.y}px;width:0;height:0`;
    return;
  }
  if (state.transformControl.axis) return;
  const hit = raycastObjects(e);
  if (hit) selectObject(hit); else deselect();
}

function onMouseUp(e: MouseEvent): void {
  if (editorMode !== "3d") return;
  if (e.button === 2) { camInput.rotating = false; document.body.style.cursor = ""; return; }
  if (e.button === 0 && state.activeTool === "select" && boxSelecting) {
    boxSelecting = false;
    if (boxEl) boxEl.style.display = "none";
    finishBoxSelect(e);
  }
}

function onMouseMove(e: MouseEvent): void {
  if (editorMode !== "3d") return;
  if (camInput.rotating) {
    const euler = new THREE.Euler(0,0,0,"YXZ");
    euler.setFromQuaternion(state.camera.quaternion);
    euler.y -= e.movementX * camConfig.sensitivity;
    euler.x -= e.movementY * camConfig.sensitivity;
    euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
    state.camera.quaternion.setFromEuler(euler);
    return;
  }
  if (state.activeTool === "paint" && e.buttons === 1) {
    const hit = raycastObjects(e); if (hit) applyPaint(hit); return;
  }
  if (state.activeTool === "select" && boxSelecting && boxEl) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const x = Math.min(cx, boxStart.x), y = Math.min(cy, boxStart.y);
    const w = Math.abs(cx - boxStart.x), h = Math.abs(cy - boxStart.y);
    boxEl.style.cssText = `display:block;position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:1px dashed #5865f2;background:rgba(88,101,242,0.08);pointer-events:none;`;
  }
}

function applyPaint(obj: THREE.Object3D): void {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (!mat) return;
  const c = new THREE.Color(state.paintColor);
  mat.color.set(c);
  const ud = obj.userData as import("./types").PolyUserData;
  if (ud.props?.Color) {
    const col = ud.props.Color as import("./types").ColorData;
    col.r = c.r; col.g = c.g; col.b = c.b;
  }
  updatePropertiesUI();
}

function finishBoxSelect(e: MouseEvent): void {
  const rect = state.renderer.domElement.getBoundingClientRect();
  const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
  const x1 = Math.min(boxStart.x, ex) / rect.width;
  const x2 = Math.max(boxStart.x, ex) / rect.width;
  const y1 = Math.min(boxStart.y, ey) / rect.height;
  const y2 = Math.max(boxStart.y, ey) / rect.height;

  if ((x2-x1) < 0.01 && (y2-y1) < 0.01) {
    const hit = raycastObjects(e);
    if (hit) selectObject(hit); else deselect();
    return;
  }
  const selected: THREE.Object3D[] = [];
  const tmpV = new THREE.Vector3();
  for (const obj of state.objects) {
    obj.getWorldPosition(tmpV); tmpV.project(state.camera);
    const sx = (tmpV.x+1)/2, sy = 1-(tmpV.y+1)/2;
    if (sx>=x1 && sx<=x2 && sy>=y1 && sy<=y2) selected.push(obj);
  }
  if (selected.length === 1) selectObject(selected[0]);
  else if (selected.length > 1) selectMultiple(selected);
  else deselect();
}

function onKeyDown(e: KeyboardEvent): void {
  const tag = (document.activeElement as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (editorMode === "gui") return;

  if (e.ctrlKey || e.metaKey) {
    if (e.code === "KeyC") { e.preventDefault(); copySelection(); return; }
    if (e.code === "KeyV") { e.preventDefault(); pasteSelection(); return; }
    if (e.code === "KeyD") { e.preventDefault(); duplicateSelection(); return; }
  }
  if (!e.ctrlKey && !e.shiftKey) {
    if (e.key === "1") setActiveTool("translate");
    if (e.key === "2") setActiveTool("rotate");
    if (e.key === "3") setActiveTool("scale");
    if (e.key === "4") setActiveTool("paint");
    if (e.key === "5") setActiveTool("select");
    if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
  }
  switch (e.code) {
    case "KeyW": camInput.forward  = true; break;
    case "KeyS": camInput.backward = true; break;
    case "KeyA": camInput.left     = true; break;
    case "KeyD": camInput.right    = true; break;
    case "KeyE": camInput.up       = true; break;
    case "KeyQ": camInput.down     = true; break;
    case "ShiftLeft": camInput.sprint = true; break;
  }
}

function onKeyUp(e: KeyboardEvent): void {
  switch (e.code) {
    case "KeyW": camInput.forward  = false; break;
    case "KeyS": camInput.backward = false; break;
    case "KeyA": camInput.left     = false; break;
    case "KeyD": camInput.right    = false; break;
    case "KeyE": camInput.up       = false; break;
    case "KeyQ": camInput.down     = false; break;
    case "ShiftLeft": camInput.sprint = false; break;
  }
}

function onResize(): void {
  const vp = document.getElementById("viewport-wrapper");
  if (!vp) return;
  state.camera.aspect = vp.clientWidth / vp.clientHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(vp.clientWidth, vp.clientHeight);
}

export { GUI_CLASSES, refreshTree, refreshExplorerTree };

init();
