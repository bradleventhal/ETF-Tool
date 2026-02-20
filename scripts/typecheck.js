import { readFileSync } from "fs";

// Just check if the files parse without obvious issues
const files = [
  "/vercel/share/v0-project/app/page.tsx",
  "/vercel/share/v0-project/lib/competitor-pitch.ts",
  "/vercel/share/v0-project/components/competitor-war-room.tsx",
  "/vercel/share/v0-project/lib/fund-types.ts",
  "/vercel/share/v0-project/lib/analysis-engine.ts",
  "/vercel/share/v0-project/lib/supabase/server.ts",
  "/vercel/share/v0-project/lib/supabase/client.ts",
  "/vercel/share/v0-project/app/api/funds/route.ts",
  "/vercel/share/v0-project/app/api/upload-funds/route.ts",
  "/vercel/share/v0-project/app/admin/page.tsx",
];

for (const f of files) {
  try {
    const content = readFileSync(f, "utf-8");
    const lines = content.split("\n");
    
    // Check for import issues
    const imports = lines.filter(l => l.trim().startsWith("import "));
    console.log(`\n=== ${f.split("/").pop()} (${lines.length} lines, ${imports.length} imports) ===`);
    imports.forEach(imp => console.log("  " + imp.trim()));
    
    // Check for obvious syntax issues
    let braceCount = 0;
    let parenCount = 0;
    for (const line of lines) {
      for (const ch of line) {
        if (ch === "{") braceCount++;
        if (ch === "}") braceCount--;
        if (ch === "(") parenCount++;
        if (ch === ")") parenCount--;
      }
    }
    if (braceCount !== 0) console.log("  WARNING: Unbalanced braces: " + braceCount);
    if (parenCount !== 0) console.log("  WARNING: Unbalanced parens: " + parenCount);
    
  } catch (e) {
    console.log(`ERROR reading ${f}: ${e.message}`);
  }
}
