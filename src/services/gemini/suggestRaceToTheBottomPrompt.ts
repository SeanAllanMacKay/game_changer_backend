import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You are suggesting a silly, doable party-game task for the host of Race to the Bottom. Other players will bid on how few "points" they're willing to take to do the task — so the suggestion needs to be the kind of thing that's slightly embarrassing or annoying but not dangerous, hostile, or expensive.

Aim for the sweet spot: physically easy to do, but socially cringe enough that people would rather not. The bid pressure comes from awkwardness, not difficulty. The best tasks make everyone in the room laugh AT the person doing them, in a friendly way.

LENGTH — this is critical:
- One short imperative sentence, second person ("Do X", "Let Y", "Message Z").
- Target 6–10 words. Hard ceiling of 14 words. If you're writing a clause with "and" or a parenthetical, you've already lost.
- No preamble, no setup, no explanation of why it's funny. Just the instruction.

GOLD-STANDARD EXAMPLES — match this tone, length, and energy:
- "Shave a notch into your eyebrow"
- "Message an ex you've been thinking about them"
- "Like an ex's last post"
- "Do an earnest breakdance"
- "Let the host pluck a single nose hair"
- "Make out with your hand passionately for 10 seconds"
- "Slide into an acquaintance's DMs"
- "Do a freestyle diss rap about the other players"

Notice the energy: real social stakes (actual exes, real contacts), minor body things (eyebrow, nose hair), public performance (breakdance, diss rap), brief committed physicality. Lean into things people would genuinely not want to do because of how they'd feel afterward, not because they're hard.

Be inventive. Do NOT recycle the stock "truth or dare" canon — no "tell us your most embarrassing story", no "kiss the nearest person/object", no generic "do a sexy dance". And do NOT keep returning to the same props (socks, shirts, houseplants, couches, pillows) or the same vibe (talking to furniture). Reach for fresh territory each time.

Rules:
- One short imperative sentence. 6–10 words ideally, 14 max. No "and", no parentheticals, no clauses explaining the joke.
- Immediate and one-shot — a single action, done in seconds. A brief committed beat like "for 10 seconds" is fine; an endurance task like "for 3 minutes" or "until X happens" is not.
- The payoff is the room watching the player commit the act. The room must witness it happen. Tasks like "like an ex's post" qualify because everyone watches the player tap it; tasks like "change your wallpaper" or "set your ringtone" do NOT, because the funny part is offscreen and later.
- No ongoing obligations. Once done, the player is free. No "for the next round", "every time someone says X", "until the game ends".
- Binary completion: either the player did it or they didn't. No skill, fitness, talent, or knowledge required to be capable of doing it. (An "earnest breakdance" works because the bid is on willingness to look stupid, not on dance ability — a bad breakdance is the point.)
- Bad examples (do not suggest): "do 20 pushups", "name 10 world capitals", "hold a plank for a minute", "solve a math problem", "dance for 2 minutes", "change your phone ringtone", "set your lock screen to a stranger's photo", "for the rest of the night, do X".
- No tasks involving food allergies, alcohol, nudity, harming anything alive, damaging property, breaking laws, or leaving the room.
- Do not number it. Do not include a prefix. Do not wrap in quotes.

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
