// Scores POST /triage against the hand-labeled cases in evals/cases.json.
// Start the server first, then run from the week2_6 folder:
//   npm run eval
// To test a server on another address:
//   EVAL_BASE_URL=http://localhost:4000 npm run eval
// Uses only Node's built-in fetch, fs and path, so nothing extra to install.

const fs = require("fs");
const path = require("path");

const baseUrl = process.env.EVAL_BASE_URL || "http://localhost:3000";
const casesPath = path.join(__dirname, "cases.json");

// Sends one case to the endpoint and returns { status, body }.
// A network problem becomes status 0, so one bad case never stops the run.
async function callTriage(input) {
  try {
    const response = await fetch(baseUrl + "/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = text; // not JSON, keep the raw text for the report
    }
    return { status: response.status, body: body };
  } catch (error) {
    return { status: 0, body: "Request failed: " + error.message };
  }
}

// Returns a list of "key: expected X, got Y" lines. An empty list means a pass.
function compare(expected, actual) {
  const problems = [];
  for (const key of Object.keys(expected)) {
    const got = actual && typeof actual === "object" ? actual[key] : undefined;
    if (got !== expected[key]) {
      problems.push(key + ": expected " + JSON.stringify(expected[key]) + ", got " + JSON.stringify(got));
    }
  }
  return problems;
}

async function main() {
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));

  // Check the server is up before sending all the cases.
  try {
    await fetch(baseUrl + "/health");
  } catch (error) {
    console.error("Cannot reach " + baseUrl + ". Start the server first with: npm start");
    process.exit(1);
  }

  console.log("Running " + cases.length + " cases against " + baseUrl + "/triage\n");

  const failures = [];
  const runStart = Date.now();

  // One case at a time, so we do not flood the model provider.
  for (const testCase of cases) {
    const caseStart = Date.now();
    const result = await callTriage(testCase.input);
    const ms = Date.now() - caseStart;

    let problems;
    if (result.status !== 200) {
      problems = ["HTTP " + result.status + ": " + JSON.stringify(result.body)];
    } else {
      problems = compare(testCase.expected, result.body);
    }

    const label = problems.length === 0 ? "PASS" : "FAIL";
    console.log(
      label + "  #" + testCase.id + "  " + testCase.kind.padEnd(9) + "  " +
      String(ms).padStart(6) + " ms  " + JSON.stringify(result.body)
    );

    if (problems.length > 0) {
      failures.push({ testCase: testCase, problems: problems });
    }
  }

  const totalMs = Date.now() - runStart;
  const passed = cases.length - failures.length;
  const accuracy = (passed / cases.length) * 100;

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log("  #" + failure.testCase.id + " (" + failure.testCase.kind + ") " + JSON.stringify(failure.testCase.input.text));
      for (const problem of failure.problems) {
        console.log("      " + problem);
      }
    }
  }

  console.log("\n==============================");
  console.log("Passed:   " + passed + " / " + cases.length);
  console.log("Accuracy: " + accuracy.toFixed(1) + "%");
  console.log("Duration: " + (totalMs / 1000).toFixed(2) + " s");
  console.log("==============================");

  // Exit code 1 on any failure, so a script or CI job can tell it did not pass.
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
