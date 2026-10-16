// Checks that the LLM provider is reachable and answers.
// Run from the week2_6 folder: npm run hello

require("dotenv").config();
const OpenAI = require("openai");

const baseURL = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

if (!baseURL || !apiKey || !model) {
  console.error("Missing LLM_BASE_URL, LLM_API_KEY or LLM_MODEL in .env");
  process.exit(1);
}

const client = new OpenAI({ baseURL: baseURL, apiKey: apiKey });

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "user", content: 'Answer with the single word "ready" and nothing else.' },
      ],
    });

    const answer = response.choices[0].message.content;
    console.log("Model:", model);
    console.log("Answer:", answer);
  } catch (error) {
    console.error("LLM call failed:", error.message);
    process.exit(1);
  }
}

main();
