import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You suggest a silly, doable task for the host of Race to the Bottom. Players bid on how few "points" they'll take to do it, so it should be slightly embarrassing or annoying but not dangerous, hostile, or expensive. Sweet spot: physically easy, but socially cringe enough that people would rather not — the bid pressure comes from awkwardness, not difficulty.

EXAMPLES — match this tone, length, and energy:
- "Shave a notch into your eyebrow"
- "Message an ex you've been thinking about them"
- "Like an ex's last post"
- "Do an earnest breakdance"
- "Let the host pluck a single nose hair"
- "Slide into an acquaintance's DMs"
- "Do a freestyle diss rap about the other players"

The energy: real social stakes (actual exes, real contacts), minor body things, public performance, brief committed physicality — things people wouldn't want to do because of how they'd feel afterward, not because they're hard. Be inventive: avoid the stock truth-or-dare canon ("most embarrassing story", "kiss the nearest person", "sexy dance") and don't keep returning to the same props (socks, shirts, houseplants, couches, pillows).

Rules:
- One short imperative sentence, second person. 6–10 words ideally, 14 max. No "and", no parentheticals, no clause explaining the joke.
- Immediate and one-shot — a single action done in seconds. A brief beat ("for 10 seconds") is fine; an endurance task ("for 3 minutes", "until X") is not.
- The room must witness it. "Like an ex's post" qualifies (everyone watches the tap); "change your wallpaper" or "set your ringtone" do NOT — the funny part is offscreen and later.
- No ongoing obligations once done. No "for the next round", "every time someone says X".
- Binary completion, no skill/fitness/talent/knowledge required (a bad "earnest breakdance" is the point — the bid is on willingness to look stupid).
- No food allergies, alcohol, nudity, harming anything alive, damaging property, breaking laws, or leaving the room.
- Do not number it, prefix it, or wrap it in quotes.

Return a JSON object of the form { "prompt": string } — exactly one suggestion.`;

// Rotated per call to break the model's tendency to anchor on the same
// few props/vibes across suggestions. Keep these terse so verbosity
// doesn't bleed into the output.
const CATEGORY_NUDGES = [
  "ex-related digital cringe",
  "DM or message to a real contact",
  "minor body alteration (eyebrow, nose hair, marker on face)",
  "public unrehearsed performance (rap, dance, monologue)",
  "physical cringe involving one of your own body parts",
  "an oddly specific food challenge",
  "an earnest declaration to the room",
  "a phone call to a named relative or boss",
  "a vocal sound effect committed to fully",
  "social-media post with real consequences",
];

/**
 * Generates a single prompt suggestion the host can drop into the input
 * for their Race to the Bottom round. The host is free to ignore it and
 * type their own; pressing the suggest button again yields another.
 */
export const suggestRaceToTheBottomPrompt = async (): Promise<string> => {
  const nudge =
    CATEGORY_NUDGES[Math.floor(Math.random() * CATEGORY_NUDGES.length)];

  const raw = await generateText({
    prompt: `Give one suggestion. Bias this one toward: ${nudge}. Keep it to one short imperative sentence, 6–10 words. Do not use socks, shirts, houseplants, couches, or pillows.`,
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
