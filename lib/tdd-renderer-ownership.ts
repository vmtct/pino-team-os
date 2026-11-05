import { readFileSync } from "node:fs";
import ts from "typescript";

const bridges = {
  "app/bo/components/registration/BoFullDetail.tsx": "DetailFrame",
  "app/bo/components/BoFullDetail.tsx": "DetailFrame",
  "app/bo/components/registration/BoQuickView.tsx": "DrawerFrame",
} as const;
/** Scoped PR2 gate; unrelated grandfathered screens are not retroactively rejected. */
export function verifyTddRendererOwnership(read = (path: string) => readFileSync(path, "utf8")): readonly string[] {
  const errors: string[] = [];
  for (const [path, owner] of Object.entries(bridges)) {
    const source = read(path), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let delegated = false;
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === owner) delegated = true;
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className") {
        const strings = (value: ts.Node) => {
          if (ts.isStringLiteral(value) && /(?:^|\s)(?:detail-cover|detail-hero|drawer-scrim|drawer-top|drawer-footer)(?:\s|$)/.test(value.text)) errors.push(`${path}: duplicate shell ownership`);
          value.forEachChild(strings);
        };
        node.forEachChild(strings);
      }
      node.forEachChild(visit);
    };
    visit(ast); if (!delegated) errors.push(`${path}: missing ${owner} bridge`);
  }
  return errors;
}
