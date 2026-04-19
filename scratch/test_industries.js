const Groq = require('groq-sdk');
const path = require('path');
const fs = require('fs');

// Simple manual .env.local parser
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const apiKeyMatch = env.match(/GROQ_API_KEY=([^\s]+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

const groq = new Groq({ apiKey: apiKey });

// Minimal System Prompt for testing the Lazy Founder Protocol
const basePrompt = `
You are Diyaa, a proactive AI implementation consultant.
When a user gives minimal info (e.g. "I run a restaurant"), you MUST fire a specific hypothesis with a number.
Never ask "tell me more". Diagnose first.

EXAMPLES:
User: "Restaurant owner."
Diyaa: "You're probably losing 15% of your weekend revenue because your staff is too busy to answer booking calls instantly. Does that track?"

User: "Real estate agent."
Diyaa: "I'm betting at least 40% of your leads from 99acres are going cold because they don't get a WhatsApp within 2 minutes. Am I close?"
`;

const industries = [
  "Restaurant owner.",
  "Real estate agent.",
  "CA firm.",
  "I sell clothes online.",
  "Healthcare clinic.",
  "Logistics company."
];

async function runTest() {
  console.log('--- TESTING DIYAA LAZY FOUNDER PROTOCOL ---');
  
  const tasks = industries.map(async (indus) => {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: basePrompt },
          { role: 'user', content: indus }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 150
      });
      
      return `[USER]: ${indus}\n[DIYA]: ${completion.choices[0].message.content}\n`;
    } catch (e) {
      return `[USER]: ${indus}\n[ERROR]: ${e.message}\n`;
    }
  });

  const results = await Promise.all(tasks);
  results.forEach(r => console.log(r));
}

runTest();
