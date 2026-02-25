import { spawnSync } from "child_process";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: "/vercel/share/v0-project" });
  return r.stdout || r.stderr || "no output";
};

console.log("=== LOG ===");
console.log(run("git", ["log", "--oneline", "-30"]));
