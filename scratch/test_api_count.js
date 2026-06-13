async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/services/news/1');
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      console.log("Items count:", envelope.data.items?.length);
    } else {
      console.log("Envelope:", envelope);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
run();
