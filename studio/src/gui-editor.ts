/**
 * GUI Editor - Visual WYSIWYG editor for PlayerGUI elements.
 * Shows a canvas overlay representing the game screen, where you can
 * place, drag, resize and inspect GUI elements (UIView, UIButton, UILabel, etc.)
 */

import type { PropData, PropConfig, PolyUserData } from "./types";

export interface GUIElement {
  id: string;
  className: string;
  props: PropData;
  propConfig: PropConfig;
  children: GUIElement[];
  domEl?: HTMLElement;
}

type GUIEditorMode = "select" | "move";

const GUI_CLASSES = [
  "UIView",
  "UIButton",
  "UILabel",
  "UITextInput",
  "UIImage",
  "UIHorizontalLayout",
  "UIVerticalLayout",
];

const DEFAULT_PROPS: Record<string, PropData> = {
  UIView: { Name: "UIView", Visible: true, ClipDescendants: false, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 100, y: 100 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0.2, g: 0.2, b: 0.2, a: 0.85 }, BorderColor: { r: 0.4, g: 0.4, b: 0.4, a: 1 }, BorderWidth: 1, CornerRadius: 4 },
  UIButton: { Name: "Button", Visible: true, ClipDescendants: false, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 100, y: 40 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0.35, g: 0.4, b: 0.95, a: 1 }, BorderColor: { r: 0.4, g: 0.5, b: 1, a: 1 }, BorderWidth: 1, CornerRadius: 6, Text: "Button", TextColor: { r: 1, g: 1, b: 1, a: 1 }, FontSize: 14, JustifyText: 1, VerticalAlign: 1 },
  UILabel: { Name: "Label", Visible: true, ClipDescendants: false, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 120, y: 28 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0, g: 0, b: 0, a: 0 }, BorderColor: { r: 0, g: 0, b: 0, a: 0 }, BorderWidth: 0, CornerRadius: 0, Text: "Label", TextColor: { r: 1, g: 1, b: 1, a: 1 }, FontSize: 14, JustifyText: 1, VerticalAlign: 1 },
  UITextInput: { Name: "TextInput", Visible: true, ClipDescendants: false, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 150, y: 32 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0.12, g: 0.12, b: 0.12, a: 1 }, BorderColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, BorderWidth: 1, CornerRadius: 4, Text: "", TextColor: { r: 1, g: 1, b: 1, a: 1 }, FontSize: 13, JustifyText: 0, VerticalAlign: 1 },
  UIImage: { Name: "Image", Visible: true, ClipDescendants: false, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 100, y: 100 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 1, g: 1, b: 1, a: 1 }, BorderColor: { r: 0, g: 0, b: 0, a: 0 }, BorderWidth: 0, CornerRadius: 0 },
  UIHorizontalLayout: { Name: "HLayout", Visible: true, ClipDescendants: true, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 300, y: 50 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0.15, g: 0.15, b: 0.15, a: 0.5 }, BorderColor: { r: 0.3, g: 0.3, b: 0.3, a: 1 }, BorderWidth: 1, CornerRadius: 0 },
  UIVerticalLayout: { Name: "VLayout", Visible: true, ClipDescendants: true, PositionOffset: { x: 0, y: 0 }, PositionRelative: { x: 0.5, y: 0.5 }, SizeOffset: { x: 150, y: 200 }, SizeRelative: { x: 0, y: 0 }, Rotation: 0, Color: { r: 0.15, g: 0.15, b: 0.15, a: 0.5 }, BorderColor: { r: 0.3, g: 0.3, b: 0.3, a: 1 }, BorderWidth: 1, CornerRadius: 0 },
};

const DEFAULT_CONFIG: PropConfig = {
  Name: "string",
  Visible: "boolean",
  ClipDescendants: "boolean",
  PositionOffset: "vector2",
  PositionRelative: "vector2",
  SizeOffset: "vector2",
  SizeRelative: "vector2",
  Rotation: "float",
  Color: "color",
  BorderColor: "color",
  BorderWidth: "float",
  CornerRadius: "float",
  Text: "string",
  TextColor: "color",
  FontSize: "float",
  JustifyText: "int",
  VerticalAlign: "int",
};

// ---- State ----
let guiElements: GUIElement[] = [];
let selectedElement: GUIElement | null = null;
let mode: GUIEditorMode = "select";
let guiPanel: HTMLElement | null = null;
let guiCanvas: HTMLElement | null = null;
let guiTreeContainer: HTMLElement | null = null;
let guiPropsContainer: HTMLElement | null = null;
let onSelectCallback: ((el: GUIElement | null) => void) | null = null;
let onChangeCallback: (() => void) | null = null;

// Drag state
let draggingEl: GUIElement | null = null;
let dragOffset = { x: 0, y: 0 };

let idCounter = 1;
function genId(): string { return "gui_" + (idCounter++); }

type Vector2Data = { x: number; y: number };

function getColorCSS(c: unknown): string {
  if (!c || typeof c !== "object") return "transparent";
  const col = c as { r: number; g: number; b: number; a: number };
  return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${col.a ?? 1})`;
}

function resolveRect(el: GUIElement, parentW: number, parentH: number): { x: number; y: number; w: number; h: number } {
  const po = el.props.PositionOffset as Vector2Data;
  const pr = el.props.PositionRelative as Vector2Data;
  const so = el.props.SizeOffset as Vector2Data;
  const sr = el.props.SizeRelative as Vector2Data;
  const w = (sr?.x ?? 0) * parentW + (so?.x ?? 100);
  const h = (sr?.y ?? 0) * parentH + (so?.y ?? 100);
  const x = (pr?.x ?? 0.5) * parentW + (po?.x ?? 0) - w / 2;
  const y = (pr?.y ?? 0.5) * parentH + (po?.y ?? 0) - h / 2;
  return { x, y, w, h };
}

function buildElementDOM(el: GUIElement, parentEl: HTMLElement, parentW: number, parentH: number): HTMLElement {
  const rect = resolveRect(el, parentW, parentH);
  const div = document.createElement("div");
  div.dataset.guiId = el.id;
  div.style.cssText = `
    position: absolute;
    left: ${rect.x}px;
    top: ${rect.y}px;
    width: ${rect.w}px;
    height: ${rect.h}px;
    box-sizing: border-box;
    background: ${getColorCSS(el.props.Color)};
    border: ${el.props.BorderWidth ?? 0}px solid ${getColorCSS(el.props.BorderColor)};
    border-radius: ${el.props.CornerRadius ?? 0}px;
    overflow: ${el.props.ClipDescendants ? "hidden" : "visible"};
    cursor: move;
    user-select: none;
    display: ${el.props.Visible === false ? "none" : "flex"};
    align-items: center;
    justify-content: center;
    font-size: ${el.props.FontSize ?? 14}px;
    color: ${getColorCSS(el.props.TextColor)};
    font-family: Inter, sans-serif;
    transform: rotate(${el.props.Rotation ?? 0}deg);
    transition: outline 0.05s;
  `;

  if (selectedElement?.id === el.id) {
    div.style.outline = "2px solid #5865f2";
    div.style.outlineOffset = "1px";
  }

  if (el.props.Text && (el.className === "UIButton" || el.className === "UILabel" || el.className === "UITextInput")) {
    const span = document.createElement("span");
    span.textContent = el.props.Text as string;
    span.style.pointerEvents = "none";
    div.appendChild(span);
  }

  if (el.className === "UIImage") {
    // Show placeholder image icon
    div.innerHTML = `<i class="fa-solid fa-image" style="font-size:24px;opacity:0.4;pointer-events:none;"></i>`;
  }

  // Show class name badge
  const badge = document.createElement("div");
  badge.style.cssText = `
    position: absolute;
    top: -18px; left: 0;
    font-size: 9px; color: #888;
    background: rgba(0,0,0,0.7);
    padding: 1px 4px; border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
    display: ${selectedElement?.id === el.id ? "block" : "none"};
  `;
  badge.textContent = el.props.Name as string || el.className;
  div.appendChild(badge);

  div.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    selectGUIElement(el);
    // Start drag
    draggingEl = el;
    const rect2 = div.getBoundingClientRect();
    dragOffset.x = e.clientX - rect2.left;
    dragOffset.y = e.clientY - rect2.top;
  });

  el.domEl = div;
  parentEl.appendChild(div);

  // Recursively build children
  for (const child of el.children) {
    buildElementDOM(child, div, rect.w, rect.h);
  }

  return div;
}

function refreshCanvas(): void {
  if (!guiCanvas) return;
  guiCanvas.innerHTML = "";
  const cw = guiCanvas.clientWidth;
  const ch = guiCanvas.clientHeight;
  for (const el of guiElements) {
    buildElementDOM(el, guiCanvas, cw, ch);
  }
}

function refreshTree(): void {
  if (!guiTreeContainer) return;
  guiTreeContainer.innerHTML = "";
  function addItem(el: GUIElement, depth: number): void {
    const item = document.createElement("div");
    item.style.cssText = `display:flex;align-items:center;padding:4px 8px 4px ${8 + depth * 14}px;cursor:pointer;font-size:12px;color:#ccc;border-radius:3px;gap:6px;`;
    item.style.background = selectedElement?.id === el.id ? "#37373d" : "transparent";
    const icon = getGUIIcon(el.className);
    item.innerHTML = `<span style="opacity:0.6">${icon}</span><span>${el.props.Name ?? el.className}</span>`;
    item.addEventListener("click", () => selectGUIElement(el));
    guiTreeContainer!.appendChild(item);
    for (const child of el.children) addItem(child, depth + 1);
  }
  for (const el of guiElements) addItem(el, 0);
}

function getGUIIcon(cls: string): string {
  const icons: Record<string, string> = {
    UIView: "🔲", UIButton: "🔘", UILabel: "🏷️", UITextInput: "✏️",
    UIImage: "🖼️", UIHorizontalLayout: "↔️", UIVerticalLayout: "↕️",
  };
  return icons[cls] ?? "□";
}

function selectGUIElement(el: GUIElement | null): void {
  selectedElement = el;
  refreshCanvas();
  refreshTree();
  renderGUIProps();
  onSelectCallback?.(el);
}

function renderGUIProps(): void {
  if (!guiPropsContainer) return;
  guiPropsContainer.innerHTML = "";

  if (!selectedElement) {
    guiPropsContainer.innerHTML = `<div style="padding:16px;color:#666;text-align:center;font-size:12px;">No GUI element selected</div>`;
    return;
  }

  const el = selectedElement;

  // Header
  const header = document.createElement("div");
  header.style.cssText = "padding:8px 12px;font-size:11px;font-weight:600;color:#aaa;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;";
  header.innerHTML = `<span>${el.className}</span>`;
  guiPropsContainer.appendChild(header);

  const propGroups: Record<string, string[]> = {
    Appearance: ["Name", "Visible", "Color", "BorderColor", "BorderWidth", "CornerRadius"],
    Layout: ["PositionRelative", "PositionOffset", "SizeRelative", "SizeOffset", "Rotation", "ClipDescendants"],
    Text: ["Text", "TextColor", "FontSize", "JustifyText", "VerticalAlign"],
  };

  for (const [group, keys] of Object.entries(propGroups)) {
    const hasAny = keys.some(k => el.props[k] !== undefined);
    if (!hasAny) continue;

    const section = document.createElement("div");
    section.style.cssText = "border-bottom:1px solid #2a2a2a;";
    const sectionTitle = document.createElement("div");
    sectionTitle.style.cssText = "padding:6px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:#666;font-weight:600;";
    sectionTitle.textContent = group;
    section.appendChild(sectionTitle);

    for (const key of keys) {
      if (el.props[key] === undefined) continue;
      const ptype = DEFAULT_CONFIG[key] || "string";
      const row = buildPropRow(key, ptype, el);
      if (row) section.appendChild(row);
    }
    guiPropsContainer.appendChild(section);
  }
}

function buildPropRow(key: string, ptype: string, el: GUIElement): HTMLElement | null {
  const row = document.createElement("div");
  row.style.cssText = "padding:4px 12px;display:flex;align-items:center;gap:8px;font-size:12px;";

  const label = document.createElement("span");
  label.style.cssText = "color:#999;min-width:110px;font-size:11px;flex-shrink:0;";
  label.textContent = key;
  row.appendChild(label);

  const val = el.props[key];

  if (ptype === "string") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = val as string;
    inp.style.cssText = "flex:1;background:#2a2a2a;border:1px solid #444;color:#eee;padding:3px 6px;border-radius:3px;font-size:12px;";
    inp.addEventListener("input", () => {
      el.props[key] = inp.value;
      if (key === "Name") refreshTree();
      refreshCanvas();
      onChangeCallback?.();
    });
    row.appendChild(inp);
  } else if (ptype === "float" || ptype === "int") {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.value = String(val);
    inp.style.cssText = "flex:1;background:#2a2a2a;border:1px solid #444;color:#eee;padding:3px 6px;border-radius:3px;font-size:12px;";
    inp.addEventListener("change", () => {
      el.props[key] = parseFloat(inp.value);
      refreshCanvas();
      onChangeCallback?.();
    });
    row.appendChild(inp);
  } else if (ptype === "boolean") {
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.checked = val as boolean;
    inp.style.cssText = "width:14px;height:14px;cursor:pointer;accent-color:#5865f2;";
    inp.addEventListener("change", () => {
      el.props[key] = inp.checked;
      refreshCanvas();
      onChangeCallback?.();
    });
    row.appendChild(inp);
  } else if (ptype === "vector2") {
    const v2 = val as Vector2Data;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:4px;flex:1;";
    (["x", "y"] as const).forEach((ax) => {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.01";
      inp.value = String(v2[ax]);
      inp.style.cssText = "flex:1;background:#2a2a2a;border:1px solid #444;color:#eee;padding:3px 4px;border-radius:3px;font-size:11px;";
      inp.addEventListener("change", () => {
        v2[ax] = parseFloat(inp.value);
        refreshCanvas();
        onChangeCallback?.();
      });
      wrap.appendChild(inp);
    });
    row.appendChild(wrap);
  } else if (ptype === "color") {
    const col = val as { r: number; g: number; b: number; a: number };
    const toHex2 = (c: number) => Math.floor(c * 255).toString(16).padStart(2, "0");
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:6px;flex:1;";
    const inp = document.createElement("input");
    inp.type = "color";
    inp.value = `#${toHex2(col.r)}${toHex2(col.g)}${toHex2(col.b)}`;
    inp.style.cssText = "width:36px;height:24px;border:none;background:transparent;cursor:pointer;padding:0;";
    // Alpha
    const alphaInp = document.createElement("input");
    alphaInp.type = "number";
    alphaInp.min = "0"; alphaInp.max = "1"; alphaInp.step = "0.05";
    alphaInp.value = String(col.a);
    alphaInp.style.cssText = "width:50px;background:#2a2a2a;border:1px solid #444;color:#eee;padding:3px 4px;border-radius:3px;font-size:11px;";
    alphaInp.title = "Alpha";
    const updateColor = () => {
      const c2 = new (window as any).DOMParser ? null : null;
      const hex = inp.value;
      col.r = parseInt(hex.slice(1, 3), 16) / 255;
      col.g = parseInt(hex.slice(3, 5), 16) / 255;
      col.b = parseInt(hex.slice(5, 7), 16) / 255;
      col.a = parseFloat(alphaInp.value);
      refreshCanvas();
      onChangeCallback?.();
    };
    inp.addEventListener("input", updateColor);
    alphaInp.addEventListener("change", updateColor);
    wrap.appendChild(inp);
    const alphaLabel = document.createElement("span");
    alphaLabel.style.cssText = "font-size:10px;color:#666;";
    alphaLabel.textContent = "α";
    wrap.appendChild(alphaLabel);
    wrap.appendChild(alphaInp);
    row.appendChild(wrap);
  } else {
    return null;
  }

  return row;
}

// ---- Public API ----

export function initGUIEditor(opts: {
  panel: HTMLElement;
  canvas: HTMLElement;
  tree: HTMLElement;
  props: HTMLElement;
  onSelect?: (el: GUIElement | null) => void;
  onChange?: () => void;
}): void {
  guiPanel = opts.panel;
  guiCanvas = opts.canvas;
  guiTreeContainer = opts.tree;
  guiPropsContainer = opts.props;
  onSelectCallback = opts.onSelect ?? null;
  onChangeCallback = opts.onChange ?? null;

  // Canvas drag handler
  guiCanvas.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement) === guiCanvas) {
      selectGUIElement(null);
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!draggingEl || !guiCanvas) return;
    const cRect = guiCanvas.getBoundingClientRect();
    const cw = guiCanvas.clientWidth;
    const ch = guiCanvas.clientHeight;
    const so = draggingEl.props.SizeOffset as Vector2Data;
    const w = so?.x ?? 100;
    const h = so?.y ?? 100;
    const newX = e.clientX - cRect.left - dragOffset.x + w / 2;
    const newY = e.clientY - cRect.top - dragOffset.y + h / 2;
    // Update PositionOffset based on relative position
    const pr = draggingEl.props.PositionRelative as Vector2Data;
    const baseX = (pr?.x ?? 0.5) * cw;
    const baseY = (pr?.y ?? 0.5) * ch;
    const po = draggingEl.props.PositionOffset as Vector2Data;
    po.x = newX - baseX;
    po.y = newY - baseY;
    refreshCanvas();
    if (selectedElement?.id === draggingEl.id) renderGUIProps();
    onChangeCallback?.();
  });

  window.addEventListener("mouseup", () => {
    draggingEl = null;
  });

  // Resize observer
  const ro = new ResizeObserver(() => refreshCanvas());
  ro.observe(guiCanvas);
}

export function addGUIElement(className: string, parentEl?: GUIElement): GUIElement {
  const props = JSON.parse(JSON.stringify(DEFAULT_PROPS[className] ?? DEFAULT_PROPS["UIView"])) as PropData;
  const propConfig = { ...DEFAULT_CONFIG };
  const el: GUIElement = { id: genId(), className, props, propConfig, children: [] };
  if (parentEl) {
    parentEl.children.push(el);
  } else {
    guiElements.push(el);
  }
  refreshCanvas();
  refreshTree();
  selectGUIElement(el);
  onChangeCallback?.();
  return el;
}

export function removeGUIElement(el: GUIElement): void {
  function removeFrom(list: GUIElement[]): boolean {
    const idx = list.findIndex(e => e.id === el.id);
    if (idx !== -1) { list.splice(idx, 1); return true; }
    for (const item of list) { if (removeFrom(item.children)) return true; }
    return false;
  }
  removeFrom(guiElements);
  if (selectedElement?.id === el.id) selectedElement = null;
  refreshCanvas();
  refreshTree();
  renderGUIProps();
  onChangeCallback?.();
}

export function getSelectedGUIElement(): GUIElement | null { return selectedElement; }

export function getGUIElements(): GUIElement[] { return guiElements; }

export function clearGUIElements(): void {
  guiElements = [];
  selectedElement = null;
  refreshCanvas();
  refreshTree();
  renderGUIProps();
}

export function loadGUIFromXML(xmlDoc: Document): void {
  clearGUIElements();

  function parseGUIItem(xmlNode: Element): GUIElement | null {
    const className = xmlNode.getAttribute("class") || "UIView";
    if (!GUI_CLASSES.includes(className) && className !== "GUI" && className !== "PlayerGUI") return null;

    const propData: PropData = {};
    const propConfig: PropConfig = {};
    const propContainer = xmlNode.querySelector(":scope > Properties");
    if (propContainer) {
      for (const p of Array.from(propContainer.children)) {
        const pName = p.getAttribute("name");
        if (!pName) continue;
        const pType = p.tagName;
        propConfig[pName] = pType;
        if (pType === "string") propData[pName] = p.textContent || "";
        else if (pType === "int" || pType === "float") propData[pName] = parseFloat(p.textContent || "0");
        else if (pType === "boolean") propData[pName] = p.textContent === "true";
        else if (pType === "vector2") {
          propData[pName] = {
            x: parseFloat(p.querySelector("X")?.textContent || "0"),
            y: parseFloat(p.querySelector("Y")?.textContent || "0"),
          };
        } else if (pType === "color") {
          propData[pName] = {
            r: parseFloat(p.querySelector("R")?.textContent || "0"),
            g: parseFloat(p.querySelector("G")?.textContent || "0"),
            b: parseFloat(p.querySelector("B")?.textContent || "0"),
            a: parseFloat(p.querySelector("A")?.textContent || "1"),
          };
        }
      }
    }

    if (className === "GUI" || className === "PlayerGUI") {
      // recurse into children
      for (const child of Array.from(xmlNode.children)) {
        if (child.tagName === "Item") {
          const childEl = parseGUIItem(child);
          if (childEl) guiElements.push(childEl);
        }
      }
      return null;
    }

    const defaults = DEFAULT_PROPS[className] ?? {};
    const mergedProps = { ...JSON.parse(JSON.stringify(defaults)), ...propData } as PropData;
    const el: GUIElement = { id: genId(), className, props: mergedProps, propConfig: { ...DEFAULT_CONFIG, ...propConfig }, children: [] };

    for (const child of Array.from(xmlNode.children)) {
      if (child.tagName === "Item") {
        const childEl = parseGUIItem(child);
        if (childEl) el.children.push(childEl);
      }
    }
    return el;
  }

  const playerGUI = xmlDoc.querySelector("Item[class='PlayerGUI']");
  if (playerGUI) {
    for (const child of Array.from(playerGUI.children)) {
      if (child.tagName === "Item") {
        const el = parseGUIItem(child);
        if (el) guiElements.push(el);
      }
    }
  }

  refreshCanvas();
  refreshTree();
  renderGUIProps();
}

export function serializeGUIToXML(doc: Document): Element {
  const playerGUI = doc.createElement("Item");
  playerGUI.setAttribute("class", "PlayerGUI");

  function serializeEl(el: GUIElement, parent: Element): void {
    const item = doc.createElement("Item");
    item.setAttribute("class", el.className);
    const propsNode = doc.createElement("Properties");

    for (const key in el.props) {
      const val = el.props[key];
      const ptype = el.propConfig[key] || DEFAULT_CONFIG[key] || "string";
      let node: Element;
      if (ptype === "string") { node = doc.createElement("string"); node.setAttribute("name", key); node.textContent = String(val); }
      else if (ptype === "float") { node = doc.createElement("float"); node.setAttribute("name", key); node.textContent = String(val); }
      else if (ptype === "int") { node = doc.createElement("int"); node.setAttribute("name", key); node.textContent = String(Math.floor(val as number)); }
      else if (ptype === "boolean") { node = doc.createElement("boolean"); node.setAttribute("name", key); node.textContent = val ? "true" : "false"; }
      else if (ptype === "vector2") {
        const v = val as Vector2Data;
        node = doc.createElement("vector2"); node.setAttribute("name", key);
        const xn = doc.createElement("X"); xn.textContent = v.x.toFixed(4); node.appendChild(xn);
        const yn = doc.createElement("Y"); yn.textContent = v.y.toFixed(4); node.appendChild(yn);
      } else if (ptype === "color") {
        const c = val as { r: number; g: number; b: number; a: number };
        node = doc.createElement("color"); node.setAttribute("name", key);
        const rn = doc.createElement("R"); rn.textContent = c.r.toFixed(4); node.appendChild(rn);
        const gn = doc.createElement("G"); gn.textContent = c.g.toFixed(4); node.appendChild(gn);
        const bn = doc.createElement("B"); bn.textContent = c.b.toFixed(4); node.appendChild(bn);
        const an = doc.createElement("A"); an.textContent = c.a.toFixed(4); node.appendChild(an);
      } else { continue; }
      propsNode.appendChild(node);
    }
    item.appendChild(propsNode);
    for (const child of el.children) serializeEl(child, item);
    parent.appendChild(item);
  }

  for (const el of guiElements) serializeEl(el, playerGUI);
  return playerGUI;
}

export { GUI_CLASSES, mode as guiEditorMode };
