import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const url = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const practiceUrl = url(compile("src/utils/practice.ts"));
const { selectRandomCombination } = await import(
  url(
    compile("src/utils/randomCombination.ts").replace(
      /(['"])\.\/practice\1/,
      JSON.stringify(practiceUrl),
    ),
  )
);
const combo = (n) => ({
  id: `set-${n}`,
  year: "2026",
  month: "Novembre",
  combination: {
    combination: n,
    combinationNumber: n,
    tasks: {
      task1: { instruction: `Message ${n}`, minWords: 60, maxWords: 120 },
      task2: { instruction: `Récit ${n}`, minWords: 120, maxWords: 150 },
      task3: {
        instruction: `Débat ${n}`,
        document1: `Source A ${n}`,
        document2: `Source B ${n}`,
        minWords: 120,
        maxWords: 180,
      },
    },
  },
});
const entries = [combo(1), combo(2), combo(3)];
let calls = 0;
const chosen = selectRandomCombination(entries, undefined, () => {
  calls++;
  return 0.5;
});
assert.equal(
  calls,
  1,
  "A click must use one draw, not three separate task draws",
);
assert.equal(chosen, entries[1]);
assert.equal(chosen.combination, entries[1].combination);
assert.equal(chosen.combination.tasks.task1.instruction, "Message 2");
assert.equal(chosen.combination.tasks.task2.instruction, "Récit 2");
assert.equal(chosen.combination.tasks.task3.document2, "Source B 2");
assert.equal(
  selectRandomCombination(entries, "set-2", () => 0.5),
  entries[2],
);
assert.equal(
  selectRandomCombination(entries, undefined, () => 0),
  entries[0],
);
assert.equal(
  selectRandomCombination(entries, undefined, () => 0.9999),
  entries[2],
);
assert.equal(
  selectRandomCombination([entries[0]], "set-1", () => 0),
  entries[0],
);
assert.equal(
  selectRandomCombination([], undefined, () => {
    throw new Error("No draw for empty pool");
  }),
  null,
);
const incomplete = combo(4);
incomplete.combination.tasks.task3.document2 = "";
assert.equal(
  selectRandomCombination([incomplete, entries[0]], undefined, () => 0),
  entries[0],
);
assert.equal(selectRandomCombination([incomplete]), null);
const { preferredTheme, initialTheme, applyTheme, THEME_STORAGE_KEY } =
  await import(url(compile("src/utils/theme.ts")));
assert.equal(preferredTheme("dark", false), "dark");
assert.equal(preferredTheme("light", true), "light");
assert.equal(preferredTheme(null, true), "dark");
assert.equal(preferredTheme("invalid", false), "light");
const oldStorage = globalThis.localStorage;
const oldDocument = globalThis.document;
const oldMedia = globalThis.matchMedia;
const storage = new Map();
const meta = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.matchMedia = () => ({ matches: true });
globalThis.document = {
  documentElement: { dataset: {}, style: {} },
  querySelector: () => ({ setAttribute: (key, value) => meta.set(key, value) }),
};
try {
  assert.equal(initialTheme(), "dark");
  applyTheme("dark");
  assert.equal(storage.get(THEME_STORAGE_KEY), "dark");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  applyTheme("light");
  assert.equal(initialTheme(), "light");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(meta.get("content"), "#f3f5fa");
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("Blocked");
    },
    setItem: () => {
      throw new Error("Blocked");
    },
  };
  assert.equal(initialTheme(), "dark");
  assert.doesNotThrow(() => applyTheme("dark"));
} finally {
  globalThis.localStorage = oldStorage;
  globalThis.document = oldDocument;
  globalThis.matchMedia = oldMedia;
}
console.log(
  "PASS: one whole random combination per draw, no mixed tasks, fresh selections, incomplete-set exclusion, theme preference, persistence and storage-blocked fallback.",
);

const { default: postcss } = await import("postcss");
const rules = postcss.parse(fs.readFileSync("src/styles/themes.css", "utf8"));
const palettes = [];
rules.walkRules((rule) => {
  if (rule.selector === ":root" || /^:root\[data-theme/.test(rule.selector)) {
    const palette = {};
    rule.walkDecls((decl) => (palette[decl.prop] = decl.value));
    palettes.push(palette);
  }
});
const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels.reduce(
    (sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i],
    0,
  );
};
for (const overrides of palettes) {
  const colors = { ...palettes[0], ...overrides };
  for (const [foreground, background] of [
    ["--text", "--surface"],
    ["--text", "--surface-muted"],
    ["--muted", "--canvas"],
    ["--muted", "--surface"],
    ["--primary-contrast", "--teal"],
    ["--sage-text", "--sage-surface"],
    ["--warning-text", "--warning-surface"],
    ["--lavender-text", "--lavender-surface"],
  ]) {
    const a = luminance(colors[foreground]),
      b = luminance(colors[background]);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      ratio >= 4.5,
      `${foreground} on ${background}: contrast ${ratio.toFixed(2)}`,
    );
  }
}
console.log(
  "PASS: text, secondary labels, buttons and status palettes meet a 4.5:1 contrast ratio in both themes.",
);
