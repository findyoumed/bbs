const fs = require('fs');

async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/services/news/11');
    if (!res.ok) {
      console.error("API error:", res.status);
      return;
    }
    const json = await res.json();
    console.log("Success:", json.success);
    const items = json.data?.items || [];
    console.log("Total items:", items.length);

    for (const item of items) {
      const bodyStr = item.body || '';
      const descStr = item.description || '';
      const titleStr = item.title || '';
      if (bodyStr.includes('%%IMAGE') || descStr.includes('%%IMAGE') || titleStr.includes('%%IMAGE')) {
        console.log("---------------------------------------");
        console.log("Article No:", item.no);
        console.log("Title:", item.title);
        console.log("Date:", item.date);
        console.log("Includes in Title:", titleStr.includes('%%IMAGE'));
        console.log("Includes in Description:", descStr.includes('%%IMAGE'));
        console.log("Includes in Body:", bodyStr.includes('%%IMAGE'));
        console.log("Body snippet:", bodyStr.slice(0, 300));
        console.log("---------------------------------------");
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
run();
