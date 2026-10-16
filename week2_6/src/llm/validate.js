// Turns raw model text into a checked triage answer, and saves failures.

const fs = require("fs");
const path = require("path");
const { TriageOutput } = require("./schema");

const quarantinePath = path.join(__dirname, "..", "..", "logs", "quarantine.jsonl");

// Models often wrap JSON in ```json fences or add a sentence like
// "Sure, here it is:". Keep only the part from the first "{" to the last "}".
function cleanModelText(rawText) {
  const text = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return text;
  }
  return text.slice(start, end + 1);
}

// Returns { ok: true, data } when the text is valid,
// or { ok: false, error } with a message saying what is wrong.
function checkModelOutput(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(cleanModelText(rawText));
  } catch (error) {
    return { ok: false, error: "Response is not valid JSON: " + error.message };
  }

  const result = TriageOutput.safeParse(parsed);
  if (!result.success) {
    // One readable line per problem, for example "category: Invalid option ...".
    const messages = result.error.issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "response";
      return field + ": " + issue.message;
    });
    return { ok: false, error: messages.join("; ") };
  }

  return { ok: true, data: result.data };
}

// Adds one JSON line to logs/quarantine.jsonl.
// A logging problem is printed but never thrown, so the request still gets its answer.
function writeQuarantine(entry) {
  try {
    fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
    fs.appendFileSync(quarantinePath, JSON.stringify(entry) + "\n", "utf8");
  } catch (error) {
    console.error("Could not write quarantine log:", error.message);
  }
}

module.exports = { cleanModelText, checkModelOutput, writeQuarantine };
