import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You suggest a prompt for the host of Make Some Noise, where each player in turn evokes your prompt with their voice alone. A great prompt is either (a) a single thing, creature, or moment with a distinctive sound, or (b) a short improv scenario rich in audible action — alternate freely.

EXAMPLES — match this tone, length, and energy:
- "Kermit the frog defending himself in a murder trial"
- "The sound of an old dial-up internet connection"
- "A lightsaber that is running dangerously low on battery"
- "A fox"
- "An imminent sneeze that never comes"
- "Stirring the creamiest mac & cheese"

The energy: vivid sensory specificity, absurd characters in serious settings, tiny moments with a whole sonic arc, and the willingness to be just one word when the thing is iconic enough. Be inventive across calls — don't recycle well-worn animals ("dog barking"), generic appliances ("blender"), or stock movie sounds ("explosion"). Reach for the specific and unexpected: not "a bird" but "a pelican landing badly".

Rules:
- One short noun/gerund phrase or single sentence. 3–18 words ideally, 25 max. No multi-clause stacks, no parentheticals after the first descriptor.
- Performable by voice in under ~10 seconds. A short arc (sneeze building) is fine; an endurance prompt ("for two minutes") is not.
- Concrete enough to evoke a specific sound or scene. Abstract feelings ("happiness") have no native sound.
- Mix the two categories — don't always return a scenario, don't always return a single thing.
- Avoid prompts that require recognizable celebrity impressions to land.
- No food allergies, alcohol, nudity, harming anything alive, damaging property, breaking laws, or sexual content.
- Do not number it, prefix it, or wrap it in quotes.

Return a JSON object of the form { "prompt": string } — exactly one suggestion.`;

// Rotated per call to break the model's tendency to anchor on the same
// few categories across suggestions. Keep these terse so verbosity
// doesn't bleed into the output.
const CATEGORY_NUDGES = [
  "a single piece of household technology with a distinctive audio signature",
  "a fictional or famous character in an unexpected, sound-rich scenario",
  "an animal or creature whose call is iconic but rarely impersonated",
  "an imminent or interrupted physical moment (sneeze, hiccup, near-miss)",
  "a vehicle, weapon, or machine malfunctioning or running out of power",
  "a cooking or food-preparation moment captured at a specific instant",
  "a weather, geological, or natural phenomenon happening at small or absurd scale",
  "an inanimate object behaving in a way it shouldn't",
  "a professional setting (court, hospital, customer service) with an absurd twist",
  "a single iconic moment from a specific decade of technology",
];

/**
 * Generates a single prompt suggestion the host can drop into the input
 * for their Make Some Noise round. The host is free to ignore it and
 * type their own; pressing the suggest button again yields another.
 */
export const suggestMakeSomeNoisePrompt = async (): Promise<string> => {
  const nudge =
    CATEGORY_NUDGES[Math.floor(Math.random() * CATEGORY_NUDGES.length)];

  const raw = await generateText({
    prompt: `Give one suggestion. Bias this one toward: ${nudge}. Keep it short and concrete; aim for 3–18 words.`,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING },
      },
      required: ["prompt"],
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  const prompt = (parsed as { prompt?: unknown })?.prompt;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error(
      `Gemini response shape invalid (expected a non-empty string, got: ${JSON.stringify(parsed).slice(0, 200)})`,
    );
  }

  return prompt;
};
