/**
 * script-editor.ts
 * In-browser script editor modal with syntax-highlighted textarea.
 * Downloads the script as a .lua file so the user's default editor can open it,
 * and re-imports on upload. Also provides an inline fallback editor.
 */

import type { PolyUserData } from "./types";
import type * as THREE from "three";

const DEFAULT_SCRIPT = `-- Script
-- This runs on the server when the game starts.

function onStart()
  print("Hello, world!")
end

onStart()
`;

const DEFAULT_LOCAL_SCRIPT = `-- LocalScript
-- This runs on the client for each player.

function onPlayerJoined(player)
  print("Welcome, " .. player.Name)
end
`;

let _overlay: HTMLElement | null = null;
let _textarea: HTMLTextAreaElement | null = null;
let _currentObj: THREE.Object3D | null = null;

/** Open the script editor modal for the given object */
export function openScriptEditor(obj: THREE.Object3D): void {
  _currentObj = obj;
  const ud = obj.userData as PolyUserData;
  if (!ud.scriptSource) {
    ud.scriptSource = ud.className === "LocalScript"
      ? DEFAULT_LOCAL_SCRIPT
      : DEFAULT_SCRIPT;
  }

  if (!_overlay) buildModal();

  _textarea!.value = ud.scriptSource;
  updateLineNumbers();
  _overlay!.style.display = "flex";
  _textarea!.focus();

  // Update title
  const title = _overlay!.querySelector<HTMLElement>("#script-modal-title");
  if (title) title.textContent = `${ud.className}: ${obj.name}`;
}

export function closeScriptEditor(): void {
  if (_overlay) _overlay.style.display = "none";
  _currentObj = null;
}

function save(): void {
  if (!_currentObj || !_textarea) return;
  const ud = _currentObj.userData as PolyUserData;
  ud.scriptSource = _textarea.value;
}

/** Download as .lua so the OS opens it in the default text editor */
function openInDefaultEditor(): void {
  if (!_currentObj || !_textarea) return;
  save();
  const ud = _currentObj.userData as PolyUserData;
  const source = ud.scriptSource ?? "";
  const blob = new Blob([source], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (_currentObj.name || "Script") + ".lua";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Re-import a .lua file back into the script */
function importScript(): void {
  if (!_currentObj) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".lua,.txt";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file || !_currentObj) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (_textarea) _textarea.value = text;
      const ud = _currentObj!.userData as PolyUserData;
      ud.scriptSource = text;
      updateLineNumbers();
    };
    reader.readAsText(file);
  };
  input.click();
}

function updateLineNumbers(): void {
  const lnEl = document.getElementById("script-line-numbers");
  if (!lnEl || !_textarea) return;
  const lines = _textarea.value.split("\n").length;
  lnEl.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join("");
}

function buildModal(): void {
  _overlay = document.createElement("div");
  _overlay.id = "script-editor-overlay";
  _overlay.style.cssText = `
    display:none;position:fixed;inset:0;z-index:2000;
    background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);
    align-items:center;justify-content:center;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background:#1a1a1a;border:1px solid #3a3a3a;border-radius:8px;
    width:820px;max-width:95vw;height:580px;max-height:90vh;
    display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.9);
    overflow:hidden;
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;background:#111;border-bottom:1px solid #333;
    font-size:13px;font-weight:600;color:#eee;gap:10px;flex-shrink:0;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <i class="fa-solid fa-code" style="color:#5865f2;"></i>
      <span id="script-modal-title">Script Editor</span>
    </div>
    <div style="display:flex;gap:6px;">
      <button id="script-btn-import" style="background:#2b2b2b;color:#ccc;border:1px solid #444;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:5px;">
        <i class="fa-solid fa-file-arrow-up"></i> Import .lua
      </button>
      <button id="script-btn-external" style="background:#2b2b2b;color:#ccc;border:1px solid #444;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:5px;" title="Download as .lua — opens in your default text editor">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in Editor
      </button>
      <button id="script-btn-save" style="background:#5865f2;color:#fff;border:1px solid #5865f2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:5px;">
        <i class="fa-solid fa-floppy-disk"></i> Save
      </button>
      <button id="script-btn-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:2px 8px;border-radius:4px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  // Info banner
  const banner = document.createElement("div");
  banner.style.cssText = `
    background:#1e2140;border-bottom:1px solid #2a3060;
    padding:6px 16px;font-size:11px;color:#8892c8;flex-shrink:0;
    display:flex;align-items:center;gap:6px;
  `;
  banner.innerHTML = `<i class="fa-solid fa-circle-info"></i>
    Tip: Click <strong style="color:#a0a8e0;">Open in Editor</strong> to download as .lua and open in your system's default text editor (VS Code, Notepad++, etc.), then <strong style="color:#a0a8e0;">Import .lua</strong> to bring it back.`;

  // Editor body
  const editorBody = document.createElement("div");
  editorBody.style.cssText = `display:flex;flex:1;overflow:hidden;font-family:'Fira Code','Cascadia Code',Consolas,monospace;font-size:13px;`;

  // Line numbers
  const lineNumbers = document.createElement("div");
  lineNumbers.id = "script-line-numbers";
  lineNumbers.style.cssText = `
    background:#141414;color:#444;padding:12px 10px;min-width:44px;
    text-align:right;user-select:none;overflow:hidden;line-height:1.6;
    border-right:1px solid #2a2a2a;font-size:12px;
  `;

  // Textarea
  _textarea = document.createElement("textarea");
  _textarea.spellcheck = false;
  _textarea.style.cssText = `
    flex:1;background:#151515;color:#d4d4d4;border:none;outline:none;
    resize:none;padding:12px 14px;line-height:1.6;tab-size:2;
    font-family:inherit;font-size:inherit;
  `;

  _textarea.addEventListener("input", () => {
    save();
    updateLineNumbers();
  });

  _textarea.addEventListener("scroll", () => {
    lineNumbers.scrollTop = _textarea!.scrollTop;
  });

  // Tab key inserts spaces
  _textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = _textarea!.selectionStart;
      const end = _textarea!.selectionEnd;
      _textarea!.value = _textarea!.value.substring(0, start) + "  " + _textarea!.value.substring(end);
      _textarea!.selectionStart = _textarea!.selectionEnd = start + 2;
      save();
      updateLineNumbers();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  });

  editorBody.appendChild(lineNumbers);
  editorBody.appendChild(_textarea);

  // Footer
  const footer = document.createElement("div");
  footer.style.cssText = `
    background:#111;border-top:1px solid #2a2a2a;padding:6px 16px;
    font-size:10px;color:#555;flex-shrink:0;display:flex;gap:16px;
  `;
  footer.innerHTML = `<span>Lua 5.1</span><span>Ctrl+S to save</span><span>Tab = 2 spaces</span>`;

  modal.appendChild(header);
  modal.appendChild(banner);
  modal.appendChild(editorBody);
  modal.appendChild(footer);
  _overlay.appendChild(modal);
  document.body.appendChild(_overlay);

  // Wire buttons
  header.querySelector("#script-btn-close")!.addEventListener("click", closeScriptEditor);
  header.querySelector("#script-btn-save")!.addEventListener("click", () => { save(); });
  header.querySelector("#script-btn-external")!.addEventListener("click", openInDefaultEditor);
  header.querySelector("#script-btn-import")!.addEventListener("click", importScript);

  // Click outside closes
  _overlay.addEventListener("click", (e) => {
    if (e.target === _overlay) closeScriptEditor();
  });
}
