export type OperatorShortcut =
  | "command"
  | "live-mode"
  | "emergency"
  | "present"
  | "escape"
  | "help"
  | "reload-blocked"
  | "undo"
  | "web-lyrics"
  | "search"
  | "optimize"
  | "checkup"
  | "bible"
  | "playlist-focus"
  | "theme-next"
  | "playlist-next"
  | "next"
  | "previous"
  | "black"
  | "logo"
  | "clear"
  | { type: "playlist-item"; index: number };

export function resolveOperatorShortcut(input: {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  typing?: boolean;
  editingSlide?: boolean;
  bibleOpen?: boolean;
  commandOpen?: boolean;
  dialogOpen?: boolean;
  live?: boolean;
}): OperatorShortcut | null {
  const key = input.key.toLowerCase();
  const modified = input.ctrl || input.meta;

  if (modified && key === "k") return "command";
  if (input.key === "F8") return "live-mode";
  if (input.key === "F9") return "emergency";
  if (input.commandOpen || input.dialogOpen) return null;
  if (input.key === "F5") return "present";
  if (input.key === "Escape") return "escape";
  if (input.key === "?" && !input.typing) return "help";

  if (modified) {
    if (key === "r") return input.live ? "reload-blocked" : null;
    if (key === "z" && !input.shift && !input.typing) return "undo";
    if (key === "f" && input.shift) return "web-lyrics";
    if (key === "f") return "search";
    if (key === "o" && input.shift) return "optimize";
    if (key === "h" && input.shift) return "checkup";
    if (key === "b") return "bible";
    if (key === "p") return "playlist-focus";
    if (key === "t") return "theme-next";
    if (key === "n") return "playlist-next";
    if (/^[1-9]$/.test(input.key)) return { type: "playlist-item", index: Number(input.key) - 1 };
  }

  if (input.typing || input.editingSlide || input.bibleOpen) return null;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(input.key)) return "next";
  if (["ArrowLeft", "PageUp"].includes(input.key)) return "previous";
  if (key === "b") return "black";
  if (key === "l") return "logo";
  if (key === "c") return "clear";
  return null;
}
