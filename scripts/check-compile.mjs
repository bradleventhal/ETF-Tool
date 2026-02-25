import { execSync } from "child_process"
try {
  const out = execSync("./node_modules/.bin/tsc --noEmit 2>&1", { cwd: "/vercel/share/v0-project", encoding: "utf8" })
  console.log("SUCCESS - no errors")
  console.log(out)
} catch (e) {
  console.log("COMPILE ERRORS:")
  console.log(e.stdout)
  console.log(e.stderr)
}
