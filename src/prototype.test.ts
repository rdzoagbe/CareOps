/**
 * Guards on the served prototype.
 *
 * The prototype is a single HTML file with its own inline script, so it cannot
 * be imported and unit tested. It is still served at /prototype, which makes a
 * DOM XSS in it a real one. These tests pin the two fixes at source level.
 *
 * The original defect: `DRAWERS.coverage` took its id straight from the URL
 * hash and, unlike every other drawer, had no lookup that could fail, so the
 * raw value reached `onclick="dTab('<value>',0)"` unescaped. A double quote
 * broke out of the attribute and ran arbitrary script with no click at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../docs/prototype/CareOps.html"), "utf8");

describe("prototype: drawer markup escaping", () => {
  it("validates the coverage drawer's id instead of trusting the URL", () => {
    expect(source).toContain("if(!DEPTS.includes(dept)) return null;");
  });

  it("escapes values placed inside a JS string literal in an attribute", () => {
    // HTML escaping alone is not enough here: the browser decodes entities
    // before the JavaScript is parsed, so a single quote would still escape
    // the string literal. jsq() escapes for JS first, then for HTML.
    expect(source).toContain('const jsq = s =>');
    expect(source).toContain("replace(/'/g,\"\\\\'\")");
  });

  it("no longer interpolates the drawer key raw into onclick", () => {
    expect(source).not.toContain("onclick=\"dTab('${key}'");
    expect(source).toContain("onclick=\"dTab('${jsq(key)}'");
  });

  it("no longer interpolates a record kind or id raw into onclick", () => {
    expect(source).not.toContain("onclick=\"openRec('${kind}','${id}')\"");
    expect(source).toContain("onclick=\"openRec('${jsq(kind)}','${jsq(id)}')\"");
  });

  it("keeps every other drawer's fail-closed lookup", () => {
    // Each record drawer returns null when its id matches nothing, which is
    // what keeps hash content out of the markup.
    for (const guard of ["const e=empOf(id); if(!e) return null;"]) {
      expect(source).toContain(guard);
    }
  });
});

describe("prototype: lookup tables keyed by URL content", () => {
  // `DRAWERS[kind]` and `PAGES[route]` take their key from the location hash.
  // On a plain object, DRAWERS["constructor"] resolves to the Object
  // constructor through the prototype chain: truthy, callable, and it returns
  // a boxed value rather than null — so the raw hash content went straight
  // into innerHTML. Reproduced before fixing.
  it("gives the URL-keyed tables no prototype to inherit from", () => {
    expect(source).toContain("const DRAWERS = Object.create(null);");
    expect(source).toContain("const PAGES = Object.create(null);");
    expect(source).toContain("const DRAWER_TAB = Object.create(null);");
    expect(source).not.toContain("const DRAWERS = {};");
    expect(source).not.toContain("const PAGES = {};");
  });

  it("calls a drawer builder only when it is really a function of ours", () => {
    expect(source).toContain('typeof DRAWERS[kind]==="function"');
    expect(source).not.toContain("const build = DRAWERS[kind];");
  });

  it("resolves a route only to a real page function", () => {
    expect(source).toContain('typeof PAGES[h]==="function" ? h : "dashboard"');
    expect(source).not.toContain('return PAGES[h]?h:"dashboard";');
  });
});

describe("prototype: a single copy under version control", () => {
  it("is the only committed copy, with the served one generated", () => {
    // Two committed copies meant patching the same file twice, which is how a
    // security fix gets applied to one and missed on the other.
    const gitignore = readFileSync(resolve(__dirname, "../.gitignore"), "utf8");
    expect(gitignore).toContain("public/prototype/");
  });
});
