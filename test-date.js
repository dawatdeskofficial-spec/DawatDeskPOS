try {
  const d = new Date("invalid");
  console.log(d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
} catch (e) {
  console.log("Error:", e.message);
}
