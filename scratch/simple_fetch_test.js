const fetch = require('node-fetch');
const industries = [
  "Restaurant owner.",
  "Real estate agent.",
  "CA firm.",
  "I sell clothes online.",
  "Healthcare clinic.",
  "Logistics company."
];

async function test() {
  for (const indus of industries) {
    console.log(`\nTesting: ${indus}`);
    // Note: We'd need the dev server running for this.
    // Since I can't guarantee the dev server port/state, 
    // I will simulate the logic call using a direct script if possible.
  }
}
test();
