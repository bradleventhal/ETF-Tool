const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

// Test fetching fund issuer info from etfdb.com
async function testEtfDb(ticker) {
  const url = `https://etfdb.com/etf/${ticker}/`
  console.log("Fetching etfdb:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    })
    console.log("Status:", res.status)
    const html = await res.text()
    console.log("Length:", html.length)
    
    // Look for issuer website link
    const issuerMatch = html.match(/Issuer[^<]*<[^>]*>[^<]*<a[^>]*href="(https?:\/\/[^"]+)"/i)
    console.log("Issuer link:", issuerMatch?.[1] || "not found")
    
    // Look for the issuer name
    const issuerName = html.match(/Issuer[^<]*<[^>]*>([^<]+)/i)
    console.log("Issuer name:", issuerName?.[1]?.trim() || "not found")
    
    // Look for any PDF links
    const pdfLinks = [...html.matchAll(/href="(https?:\/\/[^"]+\.pdf)"/gi)]
    console.log("PDF links:", pdfLinks.length)
    for (const m of pdfLinks.slice(0, 3)) console.log("  ->", m[1])
    
    // Look for prospectus/fact sheet links
    const docLinks = [...html.matchAll(/href="(https?:\/\/[^"]+(?:commentary|quarterly|factsheet|report)[^"]*)"/gi)]
    console.log("Doc links:", docLinks.length)
    for (const m of docLinks.slice(0, 3)) console.log("  ->", m[1])
  } catch (e) { console.error("Error:", e.message) }
}

// Test fetching from etf.com
async function testEtfCom(ticker) {
  const url = `https://www.etf.com/${ticker}`
  console.log("\nFetching etf.com:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    })
    console.log("Status:", res.status)
    const html = await res.text()
    console.log("Length:", html.length)
    
    // Look for issuer
    const issuer = html.match(/issuer[^<]*<[^>]*>([^<]+)/i)
    console.log("Issuer:", issuer?.[1]?.trim() || "not found")
    
    // Fund website
    const website = html.match(/fund[- ]?(?:home|page|website)[^<]*<[^>]*href="(https?:\/\/[^"]+)"/i)
    console.log("Website:", website?.[1] || "not found")
  } catch (e) { console.error("Error:", e.message) }
}

// Test fetching a direct URL that might be a commentary
async function testDirectFetch(url) {
  console.log("\nDirect fetch:", url)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    })
    console.log("Status:", res.status, "Final URL:", res.url)
    console.log("Content-Type:", res.headers.get("content-type"))
    const buf = Buffer.from(await res.arrayBuffer())
    console.log("Size:", buf.length)
    if (buf.length > 4) console.log("First bytes:", buf.toString("ascii", 0, 5))
  } catch (e) { console.error("Error:", e.message) }
}

await testEtfDb("UYLD")
await testEtfCom("UYLD")
await testDirectFetch("https://go.angeloakcapital.com/ultrashort_income_etf_commentary")
