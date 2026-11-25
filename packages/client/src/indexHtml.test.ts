import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

// The two inline scripts of index.html (the load watchdog and the nomodule script) run on browsers that cannot run the
// game: IE11, iOS 10.0 to 10.2, Chrome 49 to 60. Vite does not compile them and typecheck does not see them, so this
// test keeps them to ES5 syntax and old APIs, and keeps the markup rules around them.

/** index.html without HTML comments (the watchdog's own comment contains the text "<script>"). */
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->/g, "");

interface Inline {
  attrs: string;
  code: string;
  at: number;
}

const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1].trim(), code: m[2], at: m.index ?? 0 }));
const inline: Inline[] = tags.filter((t) => !/\bsrc=/.test(t.attrs) && !/type="module"/.test(t.attrs));
const moduleTag = tags.find((t) => /type="module"/.test(t.attrs));

/**
 * Names that browsers without module support lack: identifiers (globals) and property names called on values.
 * Both scripts must still run there, because that is where the update card is shown.
 */
const MISSING_GLOBALS = ["URLSearchParams", "CustomEvent", "Promise", "fetch", "Map", "Set", "Symbol"];
const MISSING_METHODS = ["includes", "startsWith", "endsWith", "closest", "append", "prepend", "remove", "replaceWith", "forEach", "assign", "from"];

/** Problems of one script: syntax newer than ES5 and use of missing APIs, each with its line. */
function problems(code: string): string[] {
  const source = ts.createSourceFile("inline.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found: string[] = [];
  const K = ts.SyntaxKind;
  const report = (node: ts.Node, what: string) => found.push(`line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${what}`);
  const visit = (node: ts.Node): void => {
    switch (node.kind) {
      case K.ArrowFunction: report(node, "arrow function"); break;
      case K.TemplateExpression:
      case K.NoSubstitutionTemplateLiteral: report(node, "template literal"); break;
      case K.ClassDeclaration:
      case K.ClassExpression: report(node, "class"); break;
      case K.SpreadElement:
      case K.SpreadAssignment: report(node, "spread"); break;
      case K.ObjectBindingPattern:
      case K.ArrayBindingPattern: report(node, "destructuring"); break;
      case K.ShorthandPropertyAssignment: report(node, "shorthand property"); break;
      case K.ComputedPropertyName: report(node, "computed property"); break;
      case K.MethodDeclaration: report(node, "method shorthand"); break;
      case K.ForOfStatement: report(node, "for...of"); break;
      case K.AwaitExpression: report(node, "await"); break;
      case K.QuestionDotToken: report(node, "?."); break;
      case K.QuestionQuestionToken: report(node, "??"); break;
      case K.AsteriskAsteriskToken:
      case K.AsteriskAsteriskEqualsToken: report(node, "**"); break;
      case K.Parameter: {
        const p = node as ts.ParameterDeclaration;
        if (p.initializer) report(node, "default parameter");
        if (p.dotDotDotToken) report(node, "rest parameter");
        break;
      }
      case K.VariableDeclarationList:
        if (node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) report(node, "let/const");
        break;
      case K.Identifier: {
        const name = (node as ts.Identifier).text;
        if (MISSING_GLOBALS.includes(name)) report(node, `API missing on old browsers: ${name}`);
        break;
      }
      case K.PropertyAccessExpression: {
        const name = (node as ts.PropertyAccessExpression).name.text;
        if (MISSING_METHODS.includes(name)) report(node, `API missing on old browsers: .${name}`);
        break;
      }
    }
    if (ts.isFunctionLike(node) && ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === K.AsyncKeyword)) report(node, "async function");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("index.html inline scripts", () => {
  it("has the watchdog, then the nomodule script, then the module tag", () => {
    expect(inline).toHaveLength(2);
    expect(inline[0].attrs).toBe("");
    expect(inline[1].attrs).toBe("nomodule");
    expect(moduleTag).toBeDefined();
    expect(inline[0].at).toBeLessThan(inline[1].at);
    expect(inline[1].at).toBeLessThan(moduleTag!.at);
  });

  for (const [index, label] of [[0, "watchdog"], [1, "nomodule script"]] as const) {
    it(`the ${label} parses and uses only ES5 and old APIs`, () => {
      const code = inline[index]?.code ?? "";
      const result = ts.transpileModule(code, { reportDiagnostics: true });
      expect(result.diagnostics?.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
      expect(problems(code)).toEqual([]);
    });
  }

  it("the event name is the same in the sender and the listener", () => {
    expect(inline[0].code).toContain('"petgame:no-modules"');
    expect(inline[1].code).toContain('"petgame:no-modules"');
  });

  it("keeps Tải lại whole: no plain space between the two words in any string", () => {
    const bad: string[] = [];
    for (const script of inline) {
      const source = ts.createSourceFile("inline.js", script.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) && /Tải lại/.test(node.text)) bad.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(bad).toEqual([]);
  });

  it("the load notice has no aria-live (its role says how urgent it is)", () => {
    const tag = /<div id="load-status"[^>]*>/.exec(html);
    expect(tag).not.toBeNull();
    expect(tag![0]).not.toContain("aria-live");
  });

  it("the lobby CSS uses neither inset nor min() (old browsers drop the card off screen)", () => {
    const from = html.indexOf("#lobby {");
    const to = html.indexOf("/* Phones: smaller buttons");
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    const style = html.slice(from, to);
    expect(style).not.toMatch(/\binset:/);
    expect(style).not.toMatch(/(^|[\s;{])width:\s*min\(/);
  });
});
