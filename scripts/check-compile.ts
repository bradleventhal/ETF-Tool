import { exec } from "child_process"

exec("npx --package typescript tsc --noEmit --strict 2>&1", { cwd: "/vercel/share/v0-project" }, (err, stdout, stderr) => {
  console.log("STDOUT:", stdout)
  console.log("STDERR:", stderr)
  if (err) console.log("EXIT CODE:", err.code)
})
