import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    // Scrape Morningstar search page to get the star rating
    const searchUrl = `https://www.morningstar.com/search?query=${encodeURIComponent(ticker)}`
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    })

    if (!res.ok) throw new Error(`Morningstar returned ${res.status}`)
    const html = await res.text()

    // Look for star rating pattern in the HTML -- Morningstar embeds it as aria-label or data attributes
    const ratingMatch = html.match(/rating["\s]*[:=]\s*(\d)/i)
      || html.match(/(\d)\s*star/i)
      || html.match(/mstar-rating["\s:]+(\d)/i)
      || html.match(/"starRating"\s*:\s*(\d)/i)
      || html.match(/"performanceRating"\s*:\s*(\d)/i)

    const rating = ratingMatch ? parseInt(ratingMatch[1]) : null
    const validRating = rating && rating >= 1 && rating <= 5 ? rating : null

    // Also try to extract category
    const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/i)
    const category = catMatch ? catMatch[1] : null

    return NextResponse.json({ ticker, morningstarRating: validRating, category })
  } catch (err) {
    console.error("[v0] Morningstar fetch error:", err)
    return NextResponse.json({ ticker, morningstarRating: null, category: null })
  }
}
