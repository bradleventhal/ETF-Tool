const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

// Fetch and dump the redirect page HTML
async function dumpHtml(url) {
  console.log("Fetching:", url)
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  })
  console.log("Status:", res.status, "URL:", res.url)
  const html = await res.text()
  console.log("HTML:\n", html)
}

// Try the fund company's main site for commentary pages
async function scrapeSite(domain) {
  const urls = [
    `https://${domain}`,
    `https://${domain}/quarterly-fund-commentaries`,
    `https://${domain}/insights`,
    `https://${domain}/resources`,
  ]
  for (const url of urls) {
    console.log("\n--- Fetching:", url)
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      })
      console.log("Status:", res.status)
      if (!res.ok) continue
      const html = await res.text()
      
      // Find all PDF links
      const pdfs = [...html.matchAll(/href=["']((?:https?:\/\/[^"']+|\/[^"']+)\.pdf)["']/gi)]
      console.log("PDF links found:", pdfs.length)
      for (const m of pdfs.slice(0, 10)) {
        const href = m[1].startsWith("/") ? `https://${domain}${m[1]}` : m[1]
        console.log("  ", href)
      }
      
      // Find links with "commentary" in URL or text
      const commentaryLinks = [...html.matchAll(/href=["']([^"']+)["'][^>]*>[^<]*commentary/gi)]
      console.log("Commentary links:", commentaryLinks.length)
      for (const m of commentaryLinks.slice(0, 10)) {
        console.log("  ", m[1])
      }
    } catch (e) { console.log("Error:", e.message) }
  }
}

await dumpHtml("https://go.angeloakcapital.com/ultrashort_income_etf_commentary")
await scrapeSite("angeloakcapital.com")
