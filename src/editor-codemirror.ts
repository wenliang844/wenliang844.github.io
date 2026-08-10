import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";

type MarkdownSelection = { from: number; to: number };
type MarkdownAdapter = {
  getValue(): string;
  setValue(value: string, selection?: MarkdownSelection): void;
  getSelection(): MarkdownSelection;
  focus(): void;
};

declare global {
  interface Window {
    CWLApplyMarkdownFormat?: (kind: string) => void;
    CWLMarkdownEditor?: MarkdownAdapter;
  }
}

const textarea = document.querySelector<HTMLTextAreaElement>("#markdown-input");
const host = document.querySelector<HTMLElement>("#markdown-editor");

function slashCommands(context: CompletionContext): CompletionResult | null {
  const token = context.matchBefore(/\/[^\s/]*/);
  if (!token || (!context.explicit && token.from === token.to)) return null;
  if (token.from > 0 && !/\s/.test(context.state.sliceDoc(token.from - 1, token.from))) return null;
  return {
    from: token.from,
    options: [
      { label: "/标题", detail: "二级标题", type: "keyword", apply: "## " },
      { label: "/引用", detail: "引用段落", type: "keyword", apply: "> " },
      { label: "/代码块", detail: "带语言的代码块", type: "keyword", apply: "```text\n\n```" },
      { label: "/表格", detail: "两列表格", type: "keyword", apply: "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |" },
      { label: "/内部链接", detail: "WikiLink", type: "reference", apply: "[[文章-slug|显示文字]]" },
      { label: "/任务", detail: "待办事项", type: "keyword", apply: "- [ ] " },
    ],
  };
}

function markdownDiagnostics(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  let previousHeading = 0;
  let offset = 0;

  for (const line of text.split("\n")) {
    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) {
        diagnostics.push({
          from: offset,
          to: offset + heading[0].length,
          severity: "warning",
          message: "文章标题由元数据生成，正文建议从二级标题开始。",
        });
      }
      if (previousHeading && level > previousHeading + 1) {
        diagnostics.push({
          from: offset,
          to: offset + heading[0].length,
          severity: "warning",
          message: `标题层级从 H${previousHeading} 跳到了 H${level}。`,
        });
      }
      previousHeading = level;
    }

    for (const match of line.matchAll(/!\[\s*\]\([^)]+\)/g)) {
      diagnostics.push({
        from: offset + (match.index || 0),
        to: offset + (match.index || 0) + match[0].length,
        severity: "warning",
        message: "图片缺少替代文本。",
      });
    }
    for (const match of line.matchAll(/\]\(\s*javascript:[^)]+\)/gi)) {
      diagnostics.push({
        from: offset + (match.index || 0),
        to: offset + (match.index || 0) + match[0].length,
        severity: "error",
        message: "禁止使用 javascript: 链接。",
      });
    }
    offset += line.length + 1;
  }

  const fences = [...text.matchAll(/^\s*```/gm)];
  if (fences.length % 2 !== 0) {
    const last = fences[fences.length - 1];
    diagnostics.push({
      from: last.index || 0,
      to: (last.index || 0) + last[0].length,
      severity: "error",
      message: "代码块缺少结束标记。",
    });
  }
  return diagnostics;
}

function formatKey(key: string, kind: string) {
  return {
    key,
    preventDefault: true,
    run() {
      window.CWLApplyMarkdownFormat?.(kind);
      return true;
    },
  };
}

if (textarea && host) {
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        basicSetup,
        markdown(),
        autocompletion({ override: [slashCommands], activateOnTyping: true }),
        linter(markdownDiagnostics, { delay: 350 }),
        lintGutter(),
        placeholder("开始撰写 Markdown，输入 / 可插入常用结构"),
        keymap.of([
          formatKey("Mod-b", "bold"),
          formatKey("Mod-i", "italic"),
          formatKey("Mod-k", "link"),
        ]),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            color: "var(--text)",
            backgroundColor: "transparent",
            fontSize: "0.96rem",
          },
          ".cm-content": {
            minHeight: "31rem",
            padding: "1rem 0",
            caretColor: "var(--accent)",
            fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace",
          },
          ".cm-scroller": { overflow: "auto" },
          ".cm-gutters": {
            backgroundColor: "color-mix(in srgb, var(--bg) 92%, transparent)",
            borderRight: "1px solid var(--border)",
            color: "var(--muted)",
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
          },
          ".cm-tooltip": {
            color: "var(--text)",
            backgroundColor: "var(--bg)",
            border: "1px solid var(--border)",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          textarea.value = update.state.doc.toString();
          const selection = update.state.selection.main;
          textarea.selectionStart = selection.from;
          textarea.selectionEnd = selection.to;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }),
      ],
    }),
  });

  window.CWLMarkdownEditor = {
    getValue: () => view.state.doc.toString(),
    setValue(value, selection) {
      const length = view.state.doc.length;
      const nextLength = value.length;
      const from = Math.max(0, Math.min(selection?.from ?? nextLength, nextLength));
      const to = Math.max(from, Math.min(selection?.to ?? from, nextLength));
      view.dispatch({
        changes: { from: 0, to: length, insert: value },
        selection: EditorSelection.range(from, to),
      });
    },
    getSelection() {
      const selection = view.state.selection.main;
      return { from: selection.from, to: selection.to };
    },
    focus: () => view.focus(),
  };

  host.hidden = false;
  textarea.classList.add("editor-textarea-fallback");
  document.documentElement.classList.add("codemirror-ready");

  const preview = document.querySelector<HTMLElement>("#markdown-preview");
  const scroller = view.scrollDOM;
  if (preview) {
    let syncing = false;
    scroller.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const targetMax = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = max > 0 ? (scroller.scrollTop / max) * targetMax : 0;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive: true });
    preview.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      const max = preview.scrollHeight - preview.clientHeight;
      const targetMax = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = max > 0 ? (preview.scrollTop / max) * targetMax : 0;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive: true });
  }
}
