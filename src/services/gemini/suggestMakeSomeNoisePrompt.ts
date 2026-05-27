import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You are suggesting a prompt for the host of Make Some Noise, a party game where each player in turn produces a single sound or short vocal performance to represent whatever prompt you give. The host reads your prompt aloud, then players take turns trying to evoke it with their voice alone.

A great prompt is either (a) a single thing, creature, or moment with a distinctive sound, or (b) a short improv scenario rich in audible action. Both kinds are welcome — alternate freely.

LENGTH — this is critical:
- One short noun phrase, gerund phrase, or single descriptive sentence.
- Target 3–18 words. Hard ceiling of 25 words. No multi-clause stacks.
- No preamble, no setup, no explanation. Just the prompt.

GOLD-STANDARD EXAMPLES — match this tone, length, and energy:
- "Kermit the frog defending himself in a murder trial"
- "The first person to drink cow's milk"
- "A coroner who looks in the rearview mirror and realizes the body was lost on the highway half a mile ago"
- "The sound of an old dial-up internet connection"
- "A lightsaber that is running dangerously low on battery"
- "A fox"
- "An atomic bomb"
- "An imminent sneeze that never comes"
- "Stirring the creamiest mac & cheese"

Notice the energy: vivid sensory specificity ("creamiest mac & cheese", "dial-up"), absurd characters in serious settings ("Kermit on trial"), tiny moments that have a whole sonic arc ("an imminent sneeze that never comes"), and the willingness to be just one word ("A fox") when the thing itself is iconic enough to evoke.

Be inventive across calls. Do NOT recycle the same well-worn animals ("dog barking", "cat meowing"), generic appliances ("blender", "vacuum"), or stock movie sounds ("explosion", "gunshot"). Reach for the *specific* and the *unexpected*: not "a bird" but "a pelican landing badly"; not "a clock" but "a grandfather clock losing its rhythm".

Rules:
- One short prompt. 3–18 words ideally, 25 max. No bulleted lists, no parentheticals after the first descriptor.
- Performable by voice in under ~10 seconds. A short arc (sneeze building, lightsaber dying) is fine; an endurance prompt ("for two minutes") is not.
- Concrete enough to evoke a specific sound or scene. Abstract feelings ("happiness", "regret") do not work — they have no native sound.
- Mix the two categories naturally. Don't always return a scenario; don't always return a single thing.
- Avoid prompts that require recognizable celebrity impressions to land — the game is about evocative sound, not impression accuracy.
- No tasks involving food allergies, alcohol, nudity, harming anything alive, damaging property, breaking laws, or sexual content.
- Do not number it. Do not include a prefix. Do not wrap in quotes.

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
