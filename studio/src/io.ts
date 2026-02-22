import * as THREE from "three";
import { state } from "./state";
import { createPolyObject } from "./factory";
import { refreshTree, refreshExplorerTree } from "./ui";
import { loadGUIFromXML, serializeGUIToXML, clearGUIElements } from "./gui-editor";
import type { PropData, PropConfig, Vector3Data, ColorData, PolyUserData } from "./types";

export function loadFile(e: Event): void {
  const target = e.target as HTMLInputElement;
  const file = target.files ? target.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    if (ev.target?.result) {
      parsePoly(ev.target.result as string);
    }
  };
  reader.readAsText(file);
}

export function parsePoly(text: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");

  // Clean 3D scene
  state.objects.forEach((o) => state.scene.remove(o));
  state.objects = [];

  // Clear GUI
  clearGUIElements();

  // Check for PlayerGUI node
  const playerGUINode = doc.querySelector("Item[class='PlayerGUI']");
  if (playerGUINode) {
    loadGUIFromXML(doc);
  }

  const parseItem = (xmlNode: Element, parentObj: THREE.Object3D | null) => {
    const className = xmlNode.getAttribute("class") || "Part";

    // Skip GUI nodes (handled by GUI editor)
    if (className === "PlayerGUI" || className === "GUI") return;

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
        else if (pType === "int" || pType === "float")
          propData[pName] = parseFloat(p.textContent || "0");
        else if (pType === "boolean")
          propData[pName] = p.textContent === "true";
        else if (pType === "vector3") {
          propData[pName] = {
            x: parseFloat(p.querySelector("X")?.textContent || "0"),
            y: parseFloat(p.querySelector("Y")?.textContent || "0"),
            z: parseFloat(p.querySelector("Z")?.textContent || "0"),
          } as Vector3Data;
        } else if (pType === "color") {
          propData[pName] = {
            r: parseFloat(p.querySelector("R")?.textContent || "0"),
            g: parseFloat(p.querySelector("G")?.textContent || "0"),
            b: parseFloat(p.querySelector("B")?.textContent || "0"),
            a: parseFloat(p.querySelector("A")?.textContent || "0"),
          } as ColorData;
        }
      }
    }

    const obj3d = createPolyObject(className, propData, propConfig);

    if (parentObj) parentObj.add(obj3d);
    else state.scene.add(obj3d);

    if (obj3d.type === "Mesh") state.objects.push(obj3d);

    for (const child of Array.from(xmlNode.children)) {
      if (child.tagName === "Item") parseItem(child, obj3d);
    }
  };

  const gameNode = doc.querySelector("game");
  if (gameNode) {
    for (const child of Array.from(gameNode.children)) {
      if (child.tagName === "Item") parseItem(child, null);
    }
  }
  refreshTree();
  refreshExplorerTree();
}

export function saveFile(): void {
  try {
    const xmlDoc = serializeScene();
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xmlDoc);
    const formattedXml = formatXml(xmlString);

    const blob = new Blob([formattedXml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "build.poly";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("✓ Build saved successfully!");
  } catch (error) {
    console.error("✗ Save error:", error);
    alert(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function serializeScene(): Document {
  const doc = document.implementation.createDocument(null, "game", null);
  const root = doc.documentElement;
  root.setAttribute("version", "1.0");

  // Serialize 3D objects
  state.scene.children.forEach((child) => {
    const userData = child.userData as PolyUserData;
    if (userData && userData.className) {
      const itemNode = serializeObject(child, doc);
      if (itemNode) root.appendChild(itemNode);
    }
  });

  // Serialize GUI
  const guiNode = serializeGUIToXML(doc);
  root.appendChild(guiNode);

  return doc;
}

function serializeObject(obj: THREE.Object3D, doc: Document): Element | null {
  const userData = obj.userData as PolyUserData;
  if (!userData || !userData.className) return null;

  const itemNode = doc.createElement("Item");
  itemNode.setAttribute("class", userData.className);

  const propsNode = doc.createElement("Properties");
  const props = userData.props || {};
  const propConfig = userData.propConfig || {};

  for (const key in props) {
    const value = props[key];
    const type = propConfig[key] || inferType(value);
    const propNode = createPropertyNode(doc, key, value, type);
    if (propNode) propsNode.appendChild(propNode);
  }

  itemNode.appendChild(propsNode);

  obj.children.forEach((child) => {
    const childData = child.userData as PolyUserData;
    if (childData && childData.className) {
      const childNode = serializeObject(child, doc);
      if (childNode) itemNode.appendChild(childNode);
    }
  });

  return itemNode;
}

function createPropertyNode(
  doc: Document,
  name: string,
  value: unknown,
  type: string
): Element | null {
  let propNode: Element;

  if (type === "string") {
    propNode = doc.createElement("string");
    propNode.setAttribute("name", name);
    propNode.textContent = String(value);
  } else if (type === "int") {
    propNode = doc.createElement("int");
    propNode.setAttribute("name", name);
    propNode.textContent = String(Math.floor(value as number));
  } else if (type === "float") {
    propNode = doc.createElement("float");
    propNode.setAttribute("name", name);
    propNode.textContent = String(value);
  } else if (type === "boolean") {
    propNode = doc.createElement("boolean");
    propNode.setAttribute("name", name);
    propNode.textContent = value ? "true" : "false";
  } else if (type === "vector3") {
    propNode = doc.createElement("vector3");
    propNode.setAttribute("name", name);
    const vec = value as Vector3Data;
    const xNode = doc.createElement("X"); xNode.textContent = vec.x.toFixed(6); propNode.appendChild(xNode);
    const yNode = doc.createElement("Y"); yNode.textContent = vec.y.toFixed(6); propNode.appendChild(yNode);
    const zNode = doc.createElement("Z"); zNode.textContent = vec.z.toFixed(6); propNode.appendChild(zNode);
  } else if (type === "color") {
    propNode = doc.createElement("color");
    propNode.setAttribute("name", name);
    const col = value as ColorData;
    const rNode = doc.createElement("R"); rNode.textContent = col.r.toFixed(6); propNode.appendChild(rNode);
    const gNode = doc.createElement("G"); gNode.textContent = col.g.toFixed(6); propNode.appendChild(gNode);
    const bNode = doc.createElement("B"); bNode.textContent = col.b.toFixed(6); propNode.appendChild(bNode);
    const aNode = doc.createElement("A"); aNode.textContent = col.a.toFixed(6); propNode.appendChild(aNode);
  } else {
    return null;
  }

  return propNode;
}

function inferType(value: unknown): string {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (value && typeof value === "object") {
    if ("x" in value && "y" in value && "z" in value) return "vector3";
    if ("r" in value && "g" in value && "b" in value) return "color";
  }
  return "string";
}

function formatXml(xml: string): string {
  const PADDING = "  ";
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;
  xml = xml.replace(reg, "$1\r\n$2$3");
  return xml.split("\r\n").map((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) indent = 0;
    else if (node.match(/^<\/\w/) && pad > 0) pad -= 1;
    else if (node.match(/^<\w([^>]*[^\/])?>.*$/)) indent = 1;
    else indent = 0;
    const padding = PADDING.repeat(pad);
    pad += indent;
    return padding + node;
  }).join("\r\n");
}
