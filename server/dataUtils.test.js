import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getCountrySnapshot } from "../src/utils/dataUtils.js";
import {
  extractRecommendationText,
  sanitizePlainText,
} from "./modelResponse.js";

const dataset = JSON.parse(
  fs.readFileSync(
    new URL("../public/Data/SkillGap-data/sdgData.json", import.meta.url),
    "utf8"
  )
);

test("country snapshot uses the latest year and returns ordered top and bottom five", () => {
  const snapshot = getCountrySnapshot(dataset, "008");

  assert.equal(snapshot.year, 2023);
  assert.equal(snapshot.skills.length, 16);
  assert.equal(snapshot.mostPrevalent.length, 5);
  assert.equal(snapshot.leastPrevalent.length, 5);
  assert.deepEqual(
    snapshot.mostPrevalent.map((skill) => skill.value),
    [...snapshot.mostPrevalent.map((skill) => skill.value)].sort((a, b) => b - a)
  );
  assert.deepEqual(
    snapshot.leastPrevalent.map((skill) => skill.value),
    [...snapshot.leastPrevalent.map((skill) => skill.value)].sort((a, b) => a - b)
  );
});

test("country without matching observations returns empty lists", () => {
  assert.deepEqual(getCountrySnapshot(dataset, "000"), {
    year: null,
    skills: [],
    mostPrevalent: [],
    leastPrevalent: [],
  });
});

test("sparse country uses its latest year and returns only available indicators", () => {
  const snapshot = getCountrySnapshot(dataset, "108");

  assert.equal(snapshot.year, 2020);
  assert.equal(snapshot.skills.length, 1);
  assert.equal(snapshot.mostPrevalent.length, 1);
  assert.equal(snapshot.leastPrevalent.length, 1);
  assert.ok(Number.isFinite(snapshot.skills[0].value));
});

test("extracts Gemini Interactions text output blocks", () => {
  assert.equal(
    extractRecommendationText(
      { outputs: [{ type: "text", text: "Try a guided exercise." }] },
      { interactions: true }
    ),
    "Try a guided exercise."
  );
});

test("extracts model output text nested under interaction steps", () => {
  assert.equal(
    extractRecommendationText(
      {
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "Step one." }, { type: "text", text: "Step two." }],
          },
        ],
      },
      { interactions: true }
    ),
    "Step one.\nStep two."
  );
});

test("extracts text from generateContent and chat completions responses", () => {
  assert.equal(
    extractRecommendationText({
      candidates: [{ content: { parts: [{ text: "Gemini response." }] } }],
    }),
    "Gemini response."
  );
  assert.equal(
    extractRecommendationText({
      choices: [{ message: { content: "Chat response." } }],
    }),
    "Chat response."
  );
});

test("sanitizes markdown symbols and removes direct web links", () => {
  const result = sanitizePlainText(
    "# Step 1: Practice\n* Try **privacy settings** at https://example.com/help\n" +
      "2. Review [the guide](https://example.com/guide)\n" +
      "Visit www.example.org for more."
  );

  assert.equal(
    result,
    "Step 1: Practice\nTry privacy settings at\nReview the guide\nVisit for more."
  );
  assert.doesNotMatch(result, /[#*]|https?:\/\/|www\./i);
});

test("preserves a blank line between plain-text learning steps", () => {
  const result = sanitizePlainText(
    "Step one: Check a setting.\n\nStep two: Try a practice task."
  );

  assert.equal(result, "Step one: Check a setting.\n\nStep two: Try a practice task.");
});
