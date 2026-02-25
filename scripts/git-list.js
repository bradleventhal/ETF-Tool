import { execFileSync } from "child_process";
try {
  const log = execFileSync("git", ["log", "--oneline", "-60"], { cwd: "/vercel/share/v0-project", encoding: "utf-8" });
  console.log(log);
} catch(e) {
  console.log("ERROR:", e.message?.slice(0, 500));
}
