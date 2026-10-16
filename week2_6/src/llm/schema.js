// Shapes for POST /triage, matching JOB-CARD.md.
// Zod checks the data at runtime and tells us exactly what is wrong.

const { z } = require("zod");

// The only values each field may hold. Anything else is rejected.
const CATEGORIES = ["billing", "technical", "account", "feedback", "other"];
const PRIORITIES = ["low", "medium", "high"];

// What the client must send.
// trim() runs first, so "   " counts as empty and fails min(1).
const TriageInput = z.object({
  text: z.string().trim().min(1).max(2000)
});

// What the server always sends back.
// strict() rejects any extra key, so the shape stays closed.
const TriageOutput = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    confidence: z.number().min(0).max(1)
  })
  .strict();

// The safe answer from the job card's "When unsure" rule.
const FALLBACK_RESPONSE = {
  category: "other",
  priority: "low",
  confidence: 0
};

// A fixed, valid answer used when LLM_STUB=1, so we can test offline.
const STUB_RESPONSE = {
  category: "billing",
  priority: "medium",
  confidence: 0.9
};

module.exports = {
  CATEGORIES,
  PRIORITIES,
  TriageInput,
  TriageOutput,
  FALLBACK_RESPONSE,
  STUB_RESPONSE
};
