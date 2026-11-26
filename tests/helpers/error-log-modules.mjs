import fs from "node:fs";
import ts from "typescript";
export const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
export const moduleUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
export const modelsUrl = moduleUrl(compile("server/geminiModels.ts"));
const typesUrl = moduleUrl(compile("src/types/errorLog.ts"));
export const errorLogsUrl = moduleUrl(
  compile("server/errorLogs.ts").replace("./geminiModels.js", modelsUrl).replace(
    /(["'])\.\.\/src\/types\/errorLog\.js\1/,
    JSON.stringify(typesUrl),
  ),
);
export const logger = await import(errorLogsUrl);
