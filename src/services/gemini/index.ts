import { GoogleGenAI, Type, type Schema } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

let client: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!client) {
    // SDK reads GEMINI_API_KEY from env automatically.
    client = new GoogleGenAI({});
  }
  return client;
};

export type GenerateTextProps = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  responseSchema?: Schema;
};

export const generateText = async ({
  prompt,
  systemInstruction,
  model = DEFAULT_MODEL,
  responseSchema,
}: GenerateTextProps): Promise<string> => {
  const response = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(responseSchema
        ? {
            responseMimeType: "application/json",
            responseSchema,
          }
        : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
};

export { Type };
export * from "./reformatTruthsAsWhoQuestions";
export * from "./suggestRaceToTheBottomPrompt";
export * from "./suggestMakeSomeNoisePrompt";
export * from "./suggestPencilsDownPrompt";
