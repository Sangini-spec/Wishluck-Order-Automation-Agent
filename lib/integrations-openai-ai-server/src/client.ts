import OpenAI from "openai";

const apiKey=process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error(
    "Set OPENAI_API_KEY or configure Replit OpenAI integration credentials.",
  );
}

export const openai = new OpenAI({
  apiKey,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
});
