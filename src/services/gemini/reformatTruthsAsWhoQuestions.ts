import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You are reformatting personal "truths" submitted by players of a party game called Dirty Laundry. Your job is to strip stylistic fingerprints so the author cannot be identified from the writing.

For each truth, output a single short question that:
- Starts with the word "Who".
- Summarises the core action or fact of the truth.
- Uses neutral, plain English. No slang, no era-specific vocabulary, no quirky punctuation, no all-caps, no emoji.
- Preserves the factual content. Do not invent details that were not in the original.
- Ends with a question mark.

Examples:
Input: "I confess, with no small measure of shame, that upon being entrusted with the care of my neighbour's prize-winning orchid during her three-week sojourn abroad, I permitted the creature to perish through sheer indolence, and procured a counterfeit specimen from a garden centre not two hours before her return."
Output: "Who killed their neighbor's plant while they were travelling?"

Input: "ok so one time in like ninth grade i told the whole class my dog died so i could skip a math test and then my dog ACTUALLY died like two weeks later"
Output: "Who cursed their dog to get out of a math test?"

Return a JSON array of strings, one per input truth, in the same order as the input. The array length must exactly match the number of input truths.`;

export const reformatTruthsAsWhoQuestions = async (
  truths: string[],
): Promise<string[]> => {
  if (truths.length === 0) return [];

  const prompt = truths
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n\n");

  const raw = await generateText({
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== truths.length ||
    !parsed.every((s): s is string => typeof s === "string" && s.length > 0)
  ) {
    throw new Error(
      `Gemini response shape invalid (expected ${truths.length} non-empty strings, got: ${JSON.stringify(parsed).slice(0, 200)})`,
    );
  }

  return parsed;
};
