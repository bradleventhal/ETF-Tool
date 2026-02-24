const fs = require("fs")
const path = require("path")

console.log("cwd:", process.cwd())
console.log("__dirname:", __dirname)

// Try different paths
const paths = [
  "components/fund-universe-map.tsx",
  "/vercel/share/v0-project/components/fund-universe-map.tsx",
  path.join(process.cwd(), "components/fund-universe-map.tsx"),
  path.resolve("components/fund-universe-map.tsx"),
]

for (const p of paths) {
  console.log(`\nPath: ${p}`)
  console.log("  exists:", fs.existsSync(p))
}

// List components dir from cwd
try {
  const dir = fs.readdirSync(path.join(process.cwd(), "components")).filter(f => f.includes("fund"))
  console.log("\nFund files in components/:", dir)
} catch (e) {
  console.log("Cannot read components dir:", e.message)
}
