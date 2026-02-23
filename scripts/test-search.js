const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function testDDG() {
  const query = '"UYLD" quarterly commentary filetype:pdf'
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  console.log("Testing DDG:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(10000),
    })
    console.log("DDG status:", res.status)
    const html = await res.text()
    console.log("DDG response length:", html.length)
    const uddg = [...html.matchAll(/uddg=([^&"']+)/gi)]
    console.log("DDG uddg links found:", uddg.length)
    for (const m of uddg.slice(0, 5)) {
      try { console.log("  ->", decodeURIComponent(m[1]).slice(0, 120)) } catch {}
    }
  } catch (e) { console.error("DDG error:", e.message) }
}

async function testGoogle() {
  const query = '"UYLD" quarterly commentary pdf'
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`
  console.log("\nTesting Google:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(10000),
    })
    console.log("Google status:", res.status)
    const html = await res.text()
    console.log("Google response length:", html.length)
    const urls = [...html.matchAll(/\/url\?q=(https?[^&"]+)/gi)]
    console.log("Google URL links found:", urls.length)
    for (const m of urls.slice(0, 5)) {
      try { console.log("  ->", decodeURIComponent(m[1]).slice(0, 120)) } catch {}
    }
    // Check if blocked
    if (html.includes("captcha") || html.includes("unusual traffic")) {
      console.log("Google: BLOCKED (captcha/unusual traffic)")
    }
  } catch (e) { console.error("Google error:", e.message) }
}

async function testBing() {
  const query = '"UYLD" quarterly commentary pdf'
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  console.log("\nTesting Bing:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(10000),
    })
    console.log("Bing status:", res.status)
    const html = await res.text()
    console.log("Bing response length:", html.length)
    // Bing uses <a href="..." in results
    const links = [...html.matchAll(/href="(https?:\/\/[^"]+\.pdf)"/gi)]
    console.log("Bing PDF links:", links.length)
    for (const m of links.slice(0, 5)) {
      console.log("  ->", m[1].slice(0, 120))
    }
    // Also check for regular result links
    const allLinks = [...html.matchAll(/<a[^>]+href="(https?:\/\/(?!www\.bing|login\.live|go\.microsoft)[^"]+)"/gi)]
    console.log("Bing result links:", allLinks.length)
    for (const m of allLinks.slice(0, 5)) {
      console.log("  ->", m[1].slice(0, 120))
    }
  } catch (e) { console.error("Bing error:", e.message) }
}

await testDDG()
await testGoogle()
await testBing()
