import * as THREE from "three";
import { state } from "./state";
import type { PolyUserData, Vector3Data, ColorData } from "./types";

// Track collapsed state per object uuid
const collapsedNodes = new Set<string>();

// ── Icon helpers ──────────────────────────────────────────────
function getIconHTML(className: string): string {
  switch (className) {
    case "Folder":       return `<i class="fa-solid fa-folder" style="color:#e8c32e;font-size:11px;"></i>`;
    case "Script":       return `<i class="fa-solid fa-scroll" style="color:#a0c8ff;font-size:11px;"></i>`;
    case "LocalScript":  return `<i class="fa-solid fa-user-gear" style="color:#90e0a0;font-size:11px;"></i>`;
    default:             return `<i class="fa-solid fa-cube" style="color:#4a90e2;font-size:11px;"></i>`;
  }
}

// ── Tree building ─────────────────────────────────────────────
export function refreshTree(): void {
  const root = document.getElementById("tree-view");
  if (!root) return;
  root.innerHTML = "";
  buildTree(state.scene, root, 0);
}

function buildTree(parent: THREE.Object3D, container: HTMLElement, depth: number): void {
  parent.children.forEach((child) => {
    const userData = child.userData as PolyUserData;
    if (!userData || !userData.className) return;

    const hasChildren = child.children.some(
      c => (c.userData as PolyUserData)?.className,
    );
    const isCollapsed = collapsedNodes.has(child.uuid);

    // ── Node wrapper ──
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    // ── Row ──
    const rowDiv = document.createElement("div");
    rowDiv.className = "tree-row";
    if (state.selectedObjects.includes(child)) rowDiv.classList.add("selected");
    rowDiv.draggable = true;

    // Indent
    if (depth > 0) {
      const indent = document.createElement("span");
      indent.className = "tree-indent";
      indent.style.width = `${depth * 16}px`;
      rowDiv.appendChild(indent);
    }

    // Arrow
    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    if (hasChildren) {
      arrow.classList.add(isCollapsed ? "collapsed" : "expanded");
      arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        if (collapsedNodes.has(child.uuid)) collapsedNodes.delete(child.uuid);
        else collapsedNodes.add(child.uuid);
        refreshTree();
      });
    } else {
      arrow.classList.add("leaf");
      arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
    }
    rowDiv.appendChild(arrow);

    // Icon
    const iconSpan = document.createElement("span");
    iconSpan.className = "tree-icon";
    iconSpan.innerHTML = getIconHTML(userData.className);
    rowDiv.appendChild(iconSpan);

    // Name
    const nameSpan = document.createElement("span");
    nameSpan.className = "tree-name";
    nameSpan.textContent = child.name;
    rowDiv.appendChild(nameSpan);

    // Click to select
    rowDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      selectObject(child);
    });

    // Double-click → script editor
    rowDiv.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (userData.className === "Script" || userData.className === "LocalScript") {
        import("./script-editor").then(m => m.openScriptEditor(child));
      }
    });

    // Drag
    rowDiv.addEventListener("dragstart", (e) => { e.stopPropagation(); state.dragSource = child; });
    rowDiv.addEventListener("dragover", (e) => { e.preventDefault(); rowDiv.classList.add("drag-over"); });
    rowDiv.addEventListener("dragleave", () => rowDiv.classList.remove("drag-over"));
    rowDiv.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      rowDiv.classList.remove("drag-over");
      if (state.dragSource && state.dragSource !== child) {
        child.attach(state.dragSource);
        refreshTree();
      }
    });

    userData.treeNode = rowDiv;
    nodeDiv.appendChild(rowDiv);

    // ── Children ──
    if (hasChildren) {
      const childrenDiv = document.createElement("div");
      childrenDiv.className = "tree-children" + (isCollapsed ? " hidden" : "");
      buildTree(child, childrenDiv, depth + 1);
      nodeDiv.appendChild(childrenDiv);
    }

    container.appendChild(nodeDiv);
  });
}

// ── Explorer tree (right panel) ───────────────────────────────
export function refreshExplorerTree(): void {
  const root = document.getElementById("explorer-tree");
  if (!root) return;
  root.innerHTML = "";
  buildExplorerTree(state.scene, root, 0);
}

function buildExplorerTree(parent: THREE.Object3D, container: HTMLElement, depth: number): void {
  parent.children.forEach((child) => {
    const userData = child.userData as PolyUserData;
    if (!userData || !userData.className) return;

    const hasChildren = child.children.some(c => (c.userData as PolyUserData)?.className);
    const isCollapsed = collapsedNodes.has(child.uuid);

    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const rowDiv = document.createElement("div");
    rowDiv.className = "tree-row";
    if (state.selectedObjects.includes(child)) rowDiv.classList.add("selected");
    rowDiv.draggable = true;

    if (depth > 0) {
      const indent = document.createElement("span");
      indent.className = "tree-indent";
      indent.style.width = `${depth * 16}px`;
      rowDiv.appendChild(indent);
    }

    // Arrow
    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    if (hasChildren) {
      arrow.classList.add(isCollapsed ? "collapsed" : "expanded");
      arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        if (collapsedNodes.has(child.uuid)) collapsedNodes.delete(child.uuid);
        else collapsedNodes.add(child.uuid);
        refreshExplorerTree();
      });
    } else {
      arrow.classList.add("leaf");
      arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
    }
    rowDiv.appendChild(arrow);

    const iconSpan = document.createElement("span");
    iconSpan.className = "tree-icon";
    iconSpan.innerHTML = getIconHTML(userData.className);
    rowDiv.appendChild(iconSpan);

    const nameSpan = document.createElement("span");
    nameSpan.className = "tree-name";
    nameSpan.textContent = child.name;
    rowDiv.appendChild(nameSpan);

    rowDiv.addEventListener("click", (e) => { e.stopPropagation(); selectObject(child); });
    rowDiv.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (userData.className === "Script" || userData.className === "LocalScript") {
        import("./script-editor").then(m => m.openScriptEditor(child));
      }
    });

    rowDiv.addEventListener("dragstart", (e) => { e.stopPropagation(); state.dragSource = child; });
    rowDiv.addEventListener("dragover", (e) => { e.preventDefault(); rowDiv.classList.add("drag-over"); });
    rowDiv.addEventListener("dragleave", () => rowDiv.classList.remove("drag-over"));
    rowDiv.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      rowDiv.classList.remove("drag-over");
      if (state.dragSource && state.dragSource !== child) {
        child.attach(state.dragSource);
        refreshTree();
        refreshExplorerTree();
      }
    });

    userData.treeNode = rowDiv;
    nodeDiv.appendChild(rowDiv);

    if (hasChildren) {
      const childrenDiv = document.createElement("div");
      childrenDiv.className = "tree-children" + (isCollapsed ? " hidden" : "");
      buildExplorerTree(child, childrenDiv, depth + 1);
      nodeDiv.appendChild(childrenDiv);
    }

    container.appendChild(nodeDiv);
  });
}

// ── Selection helpers ─────────────────────────────────────────
export function selectObject(obj: THREE.Object3D): void {
  state.selectedObject = obj;
  state.selectedObjects = [obj];
  const ud = obj.userData as PolyUserData;
  const isTransformable = ud.className !== "Script" && ud.className !== "LocalScript" && ud.className !== "Folder";
  if (isTransformable) state.transformControl.attach(obj);
  else state.transformControl.detach();
  document.querySelectorAll(".tree-row").forEach(el => el.classList.remove("selected"));
  if (ud.treeNode) ud.treeNode.classList.add("selected");
  updatePropertiesUI();
}

export function selectMultiple(objs: THREE.Object3D[]): void {
  state.selectedObjects = objs;
  state.selectedObject = objs[0] ?? null;
  state.transformControl.detach();
  document.querySelectorAll(".tree-row").forEach(el => el.classList.remove("selected"));
  for (const obj of objs) {
    const ud = obj.userData as PolyUserData;
    if (ud.treeNode) ud.treeNode.classList.add("selected");
  }
  const content = document.getElementById("prop-content");
  if (content) content.innerHTML = `<div class="no-selection">${objs.length} objects selected</div>`;
}

export function deselect(): void {
  state.selectedObject = null;
  state.selectedObjects = [];
  state.transformControl.detach();
  document.querySelectorAll(".tree-row").forEach(el => el.classList.remove("selected"));
  updatePropertiesUI();
}

// ── Sync transforms → props ───────────────────────────────────
export function syncTransformsToProps(obj: THREE.Object3D): void {
  const userData = obj.userData as PolyUserData;
  const p = userData.props;
  if (!p) return;
  if (p.Position) { const pos = p.Position as Vector3Data; pos.x = obj.position.x; pos.y = obj.position.y; pos.z = obj.position.z; }
  if (p.Size)     { const sz  = p.Size     as Vector3Data; sz.x  = obj.scale.x;    sz.y  = obj.scale.y;    sz.z  = obj.scale.z; }
  if (p.Rotation) { const rot = p.Rotation as Vector3Data; rot.x = THREE.MathUtils.radToDeg(obj.rotation.x); rot.y = THREE.MathUtils.radToDeg(obj.rotation.y); rot.z = THREE.MathUtils.radToDeg(obj.rotation.z); }
}

// ── Properties panel ──────────────────────────────────────────
export function updatePropertiesUI(): void {
  const content = document.getElementById("prop-content");
  if (!content) return;
  content.innerHTML = "";
  const obj = state.selectedObject;
  if (!obj) { content.innerHTML = `<div class="no-selection">No Selection</div>`; return; }

  const userData = obj.userData as PolyUserData;
  const isScript = userData.className === "Script" || userData.className === "LocalScript";

  if (isScript) {
    const panel = document.createElement("div");
    panel.style.cssText = "padding:10px;display:flex;flex-direction:column;gap:8px;";

    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;gap:7px;padding:7px;background:#222;border-radius:4px;border:1px solid #2e2e2e;";
    hdr.innerHTML = `${getIconHTML(userData.className)}<div><div style="font-size:12px;font-weight:600;color:#eee;">${obj.name}</div><div style="font-size:10px;color:#666;">${userData.className}</div></div>`;
    panel.appendChild(hdr);

    const nr = document.createElement("div");
    nr.innerHTML = `<span class="prop-label">Name</span><input type="text" value="${obj.name}">`;
    nr.querySelector("input")!.onchange = (e) => {
      obj.name = (e.target as HTMLInputElement).value;
      userData.props.Name = obj.name;
      refreshTree(); refreshExplorerTree();
    };
    panel.appendChild(nr);

    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.style.cssText = "width:100%;justify-content:center;margin-top:2px;";
    btn.innerHTML = `<i class="fa-solid fa-code"></i> Open Script Editor`;
    btn.onclick = () => import("./script-editor").then(m => m.openScriptEditor(obj));
    panel.appendChild(btn);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:10px;color:#555;text-align:center;";
    hint.textContent = "Double-click in Explorer to open";
    panel.appendChild(hint);

    content.appendChild(panel);
    return;
  }

  const props  = userData.props     || {};
  const config = userData.propConfig || {};

  const groups: Record<string, string[]> = {
    Data:      ["Name", "ClassName", "Shape", "Material"],
    Transform: ["Position", "Rotation", "Size"],
    Appearance:["Color", "Opacity", "Transparency", "Reflectance"],
    Physics:   ["Anchored", "CanCollide", "Mass", "Friction", "Elasticity"],
    Other:     [],
  };
  const getGroup = (k: string): string => { for (const g in groups) if (groups[g].includes(k)) return g; return "Other"; };
  const buckets: Record<string, string[]> = {};
  for (const k in props) { const g = getGroup(k); if (!buckets[g]) buckets[g] = []; buckets[g].push(k); }

  ["Data","Transform","Appearance","Physics","Other"].forEach((g) => {
    if (!buckets[g] || !buckets[g].length) return;
    const gDiv = document.createElement("div");
    gDiv.className = "prop-group";
    gDiv.innerHTML = `<div class="prop-header-txt">${g}</div>`;
    const ctr = document.createElement("div");
    ctr.className = "prop-row-container";

    buckets[g].forEach((k) => {
      const type = config[k] || typeof props[k];
      const row = document.createElement("div");
      const lbl = `<span class="prop-label">${k}</span>`;

      if (type === "string" || type === "float" || type === "int") {
        row.innerHTML = lbl + `<input type="${type === "string" ? "text" : "number"}" value="${props[k]}">`;
        row.querySelector("input")!.onchange = (e) => {
          const t = e.target as HTMLInputElement;
          const nv = type === "string" ? t.value : parseFloat(t.value);
          props[k] = nv;
          if (k === "Name") { obj.name = nv as string; refreshTree(); refreshExplorerTree(); }
        };
      } else if (type === "boolean") {
        const val = props[k] as boolean;
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
        row.innerHTML = `<span class="prop-label" style="margin:0;">${k}</span><input type="checkbox" ${val ? "checked" : ""}>`;
        row.querySelector("input")!.onchange = (e) => { props[k] = (e.target as HTMLInputElement).checked; };
      } else if (type === "vector3") {
        const val = props[k] as Vector3Data;
        row.innerHTML = lbl;
        const inp = document.createElement("div");
        inp.style.cssText = "display:flex;gap:3px;";
        (["x","y","z"] as const).forEach((ax) => {
          const i = document.createElement("input"); i.type = "number"; i.step = "0.1"; i.value = val[ax].toFixed(3);
          i.onchange = (e) => {
            val[ax] = parseFloat((e.target as HTMLInputElement).value);
            if (k === "Position") obj.position[ax] = val[ax];
            if (k === "Size")     obj.scale[ax]    = val[ax];
            if (k === "Rotation") obj.rotation[ax] = THREE.MathUtils.degToRad(val[ax]);
          };
          inp.appendChild(i);
        });
        row.appendChild(inp);
      } else if (type === "color") {
        const val = props[k] as ColorData;
        row.innerHTML = lbl;
        const h = (c: number) => Math.floor(c * 255).toString(16).padStart(2, "0");
        const i = document.createElement("input"); i.type = "color";
        i.value = `#${h(val.r)}${h(val.g)}${h(val.b)}`;
        i.oninput = (e) => {
          const c = new THREE.Color((e.target as HTMLInputElement).value);
          val.r = c.r; val.g = c.g; val.b = c.b;
          if ((obj as THREE.Mesh).material) ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(c);
        };
        row.appendChild(i);
      }
      ctr.appendChild(row);
    });
    gDiv.appendChild(ctr);
    content.appendChild(gDiv);
  });
}
