import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You suggest a drawing prompt for the host of Pencils Down. Every non-host player has three minutes to draw the prompt with one finger on a phone; the host picks their favourite.

A great prompt is an OPEN CREATIVE BRIEF, not a thing to copy. Ten players should invent ten different answers — the comedy is in each player's idea, not their drawing skill. If everyone would draw the same picture it's a bad prompt. Literal subjects ("a cat", "a shark on a skateboard") are banned.

THE FINGER-ON-PHONE LIMIT: the idea can be ambitious but the ANSWER must be ONE simple, concrete subject — a single character, object, creature, or piece of artwork that fills the frame. If it needs a busy scene, multiple characters, a sequence of events, or a split-second of timing, reject it (e.g. "the exact second a first date goes wrong" — that's a moment, not a thing to draw). The joke must land through imagery, never readable text (a finger can't write legibly), so even posters/album covers/book covers must work as pictures.

TWO KINDS — rotate across both, each resolving to ONE drawable subject:
1) AN ILLUSTRATION FORMAT attached to an absurdly mismatched subject (the clash is the joke): "A tramp stamp your grandma might have", "A cover for Sesame Street's new death metal album", "A billboard for ketamine", "A motivational poster for giving up", "A wanted poster for the Tooth Fairy".
2) A NEW INVENTED THING (the comedy is whatever they come up with): "The next big thing", "A better mousetrap", "A new pokemon", "The next big horror movie monster", "An animal that evolution forgot", "The world's least useful superhero", "What your dog dreams about".

TONE: cheeky, irreverent PG-13 — a little dark or rude; topical and pop-culture references welcome (drugs, death metal, politics, bodily mishaps). No explicit sexual content, gore, slurs, or hate. Don't hinge on a specific celebrity's likeness or a real brand logo.

LENGTH: one short phrase, 4–11 words (14 max). No clause explaining the joke, no preamble, no quotes.

Return a JSON object of the form { "prompt": string } — exactly one suggestion.`;

// Rotated per call to push variety across the three prompt kinds and the
// angles within them. Keep these terse so verbosity doesn't bleed into the
// output.
const CATEGORY_NUDGES = [
  "an illustration format (poster, album cover, billboard, tattoo, logo) for an absurdly mismatched subject",
  "a greeting card, book cover, or advertisement for something that would never have one",
  "a brand-new invented creature — a new pokemon, monster, or an animal evolution forgot",
  "a new invented product, gadget, or 'next big thing' nobody asked for",
  "a new mascot, flag, god, or symbol for an unexpected group or institution",
  "a new villain, superhero, or sidekick nobody asked for",
  "a wholesome brand or character reimagined in a dark or edgy way",
  "an absurd 'design the ___' brief that invites wildly different single subjects",
  "a warning label, road sign, or trophy for something ridiculous",
  "a redesigned everyday object that has gone horribly wrong",
];

/**
 * Generates a single drawing-prompt suggestion the host can drop into the
 * input for their Pencils Down round. Prompts are open creative briefs —
 * "draw an X" challenges that ten players answer ten different ways — tuned
 * to be conveyable as a crude finger sketch on a phone. The host is free to
 * ignore it and type their own; pressing the suggest button again yields
 * another.
 */
export const suggestPencilsDownPrompt = async (): Promise<string> => {
  const nudge =
    CATEGORY_NUDGES[Math.floor(Math.random() * CATEGORY_NUDGES.length)];

  const raw = await generateText({
    prompt: `Give one drawing prompt. Bias this one toward: ${nudge}. One short phrase, 4–11 words. It must be an OPEN creative brief that ten players would answer ten different ways — never a literal object to copy. Each answer must resolve to ONE simple, concrete subject a player can draw with a finger in three minutes — not a scene, a sequence of events, or a split-second moment. The joke must land through imagery, not text.`,
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
