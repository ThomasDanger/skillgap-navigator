import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getCountrySnapshot } from "../src/utils/dataUtils.js";
import {
  extractRecommendationText,
  sanitizePlainText,
} from "./modelResponse.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "public", "Data", "SkillGap-data", "sdgData.json");
const dataset = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const production = process.argv.includes("--production");
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.get("/api/status", (_request, response) => {
  response.json({
    recommendationModelConfigured: Boolean(
      process.env.MODEL_API_KEY &&
        process.env.MODEL_NAME &&
        process.env.MODEL_API_URL
    ),
  });
});

app.post("/api/recommendations", async (request, response) => {
  const { countryCode, skillCode } = request.body ?? {};
  const country = dataset.countries.find((item) => item.code === countryCode);

  if (!country || typeof skillCode !== "string") {
    return response.status(400).json({ error: "Select a valid country and topic." });
  }

  const snapshot = getCountrySnapshot(dataset, countryCode);
  const skill = snapshot.skills.find((item) => item.skillCode === skillCode);
  if (!skill) {
    return response.status(404).json({
      error: "No latest-snapshot data is available for that topic and country.",
    });
  }

  const { MODEL_API_KEY, MODEL_API_URL, MODEL_NAME } = process.env;
  if (!MODEL_API_KEY || !MODEL_API_URL || !MODEL_NAME) {
    return response.status(503).json({
      error:
        "The learning model is not configured. Set MODEL_API_URL, MODEL_API_KEY, and MODEL_NAME on the server.",
    });
  }

  try {
    const modelUrl = new URL(MODEL_API_URL);
    const usesGeminiApi =
      modelUrl.hostname === "generativelanguage.googleapis.com";
    const usesGeminiNativeApi =
      usesGeminiApi && !modelUrl.pathname.includes("/openai/");
    const usesGeminiInteractionsApi =
      usesGeminiApi && modelUrl.pathname.endsWith("/interactions");
    const learningPrompt =
      `Suggest how someone can begin learning: ${skill.skill}. ` +
      `Country context: ${country.name}. The latest available ` +
      `national indicator is ${skill.value}% for ${skill.year}. ` +
      "Treat this statistic as background context only; it is not " +
      "a measure of this person's ability. Focus on an individual " +
      "learning plan.";
    const systemPrompt =
      "You are a practical digital-skills learning coach. Give a safe, " +
      "beginner-friendly and achievable way to start practicing. " +
      "Suggest 3-5 concrete steps and free tools or resources where " +
      "possible. Do not infer the user's abilities from national " +
      "statistics. Be concise and avoid claiming the user personally " +
      "has a skill gap. Return plain text only: do not use Markdown, " +
      "including headings, bullets, numbered lists, bold, italics, " +
      "backticks, or other Markdown symbols. Never include the # or * " +
      "characters anywhere in the response. Write each learning step as " +
      "its own short plain-text paragraph, separated from the next step " +
      "by one blank line (two line breaks). " +
      "plain-text sentences or paragraphs. Do not include URLs, web " +
      "addresses, hyperlinks, or direct links to websites.";

    const modelResponse = await fetch(MODEL_API_URL, {
      method: "POST",
      headers: {
        ...(usesGeminiNativeApi
          ? { "x-goog-api-key": MODEL_API_KEY }
          : { Authorization: `Bearer ${MODEL_API_KEY}` }),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(
        usesGeminiNativeApi
          ? usesGeminiInteractionsApi
            ? {
                model: MODEL_NAME,
                system_instruction: systemPrompt,
                input: learningPrompt,
                generation_config: { max_output_tokens: 500 },
                store: false,
              }
            : {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: learningPrompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
              }
          : {
              model: MODEL_NAME,
              temperature: 0.4,
              max_tokens: 500,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: learningPrompt },
              ],
            }
      ),
    });

    if (!modelResponse.ok) {
      const errorBody = await modelResponse.text();
      let providerMessage = "";
      try {
        const parsedError = JSON.parse(errorBody);
        providerMessage =
          parsedError.error?.message ??
          parsedError.message ??
          "";
      } catch {
        providerMessage = "";
      }
      console.error(
        `Recommendation model request failed (HTTP ${modelResponse.status}):`,
        providerMessage || "Provider returned no error message."
      );
      return response.status(502).json({
        error: providerMessage
          ? `The learning model request failed (HTTP ${modelResponse.status}): ${providerMessage}`
          : `The learning model request failed (HTTP ${modelResponse.status}).`,
      });
    }

    const result = await modelResponse.json();
    const rawRecommendation = extractRecommendationText(result, {
      interactions: usesGeminiInteractionsApi,
    });
    const recommendation =
      typeof rawRecommendation === "string"
        ? sanitizePlainText(rawRecommendation)
        : "";
    if (!recommendation) {
      console.error("Recommendation model returned no recognized text output.", {
        responseKeys: Object.keys(result),
        status: result.status,
        outputTypes: [
          ...(Array.isArray(result.output) ? result.output : []),
          ...(Array.isArray(result.outputs) ? result.outputs : []),
          ...(Array.isArray(result.steps) ? result.steps : []),
        ].map((item) => item?.type).filter(Boolean),
      });
      const finishReason = result.candidates?.[0]?.finishReason;
      if (finishReason) {
        console.error("Recommendation model returned no text:", finishReason);
        return response.status(502).json({
          error: `The learning model returned no text (finish reason: ${finishReason}).`,
        });
      }
      return response.status(502).json({
        error: "The learning model returned an empty or unsupported response.",
      });
    }

    return response.json({ recommendation });
  } catch (error) {
    console.error("Recommendation model request failed:", error);
    return response.status(502).json({
      error: "Could not reach the learning model. Check the server configuration and try again.",
    });
  }
});

if (production) {
  const distPath = path.join(root, "dist");
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html")) {
      return response.sendFile(path.join(distPath, "index.html"));
    }
    return next();
  });
}

const port = Number(process.env.PORT) || (production ? 3000 : 3001);
app.listen(port, () => {
  console.log(`SkillGap Navigator server listening on http://localhost:${port}`);
});
