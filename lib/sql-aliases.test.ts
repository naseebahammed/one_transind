// A query's `AS` aliases are the field names its rows arrive with, and the type check cannot see them.
// For every `pg.query<Row>(sql)` in lib/data.ts this compares the row type's fields with the SQL's aliases.
// Only lib/data.ts: every column it reads from the ERP view is upper-case ("NET_AMOUNT"), so each output column has an alias
// and the comparison is exact. Elsewhere plain columns (`SELECT id, name`) and `${COLS}` lists would need a real SQL parser.
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import ts from "typescript";

const FILE = join(import.meta.dirname, "data.ts");
const CASTS = /^(text|int|integer|float8|numeric|date)$/i; // `CAST(x AS INTEGER)` is not an alias

/** Aliases as Postgres returns them: quoted ones keep their case, unquoted ones are lowercased. */
const aliasesOf = (sql: string) =>
  [...new Set([...sql.matchAll(/\bAS\s+(?:"(\w+)"|(\w+))/gi)].map((m) => m[1] ?? m[2].toLowerCase()).filter((a) => !CASTS.test(a)))].sort();

test("aliasesOf keeps quoted case, lowercases unquoted names and skips casts", () => {
  assert.deepEqual(aliasesOf(`SELECT x AS "lastMonth", y AS lastYear, CAST(z AS INTEGER) AS id`), ["id", "lastMonth", "lastyear"]);
});

test("every query in lib/data.ts returns exactly the fields its row type declares", () => {
  const program = ts.createProgram([FILE], { strict: true, noEmit: true, allowImportingTsExtensions: true, baseUrl: join(import.meta.dirname, ".."), paths: { "@/*": ["./*"] } });
  const checker = program.getTypeChecker(), sf = program.getSourceFile(FILE)!;
  const problems: string[] = [];
  let checked = 0;
  (function walk(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === "pg.query" && node.typeArguments?.length) {
      checked++;
      const fields = checker.getTypeFromTypeNode(node.typeArguments[0]).getProperties().map((p) => p.name).sort();
      const aliases = aliasesOf(node.arguments[0].getText(sf));
      if (fields.join() !== aliases.join()) problems.push(`line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}\n  type: ${fields.join(", ")}\n  sql:  ${aliases.join(", ")}`);
    }
    node.forEachChild(walk);
  })(sf);
  assert.ok(checked >= 14, `found only ${checked} queries; the search is broken`);
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});
