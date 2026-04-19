const Groq = require('groq-sdk');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
].filter(Boolean);

async function test() {
  console.log('Testing Groq connection with key 0...');
  const groq = new Groq({ apiKey: GROQ_KEYS[0] });
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Explain the "Illness Script" concept for a Real Estate agency in 2 sentences.' }],
      model: 'llama-3.3-70b-versatile',
    });
    console.log('SUCCESS:', chatCompletion.choices[0].message.content);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

test();
