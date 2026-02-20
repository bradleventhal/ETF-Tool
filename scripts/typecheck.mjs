import { execSync } from "child_process"
try {
  const out = execSync("cd /vercel/share/v0-project && npx tsc --noEmit 2>&1", { encoding: "utf-8", timeout: 30000 })
  console.log(out || "No errors")
} catch (e) {
  console.log(e.stdout || "")
  console.log(e.stderr || "")
}
