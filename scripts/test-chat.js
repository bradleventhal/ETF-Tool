const BASE = "http://localhost:3000"

async function testChat() {
  console.log("Testing /api/chat...")
  
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "test-1",
            role: "user",
            parts: [{ type: "text", text: "Say hello in one sentence." }],
          }
        ],
        fundContext: "Test context: Fund A vs Fund B",
      }),
    })

    console.log("Status:", res.status, res.statusText)
    console.log("Content-Type:", res.headers.get("content-type"))
    
    if (!res.ok) {
      const text = await res.text()
      console.log("Error body:", text.slice(0, 500))
      return
    }

    const text = await res.text()
    console.log("Response (first 500 chars):", text.slice(0, 500))
  } catch (err) {
    console.error("Fetch failed:", err.message)
  }
}

testChat()
