import { generateText, Type } from "./index";

const SYSTEM_INSTRUCTION = `You are suggesting a drawing prompt for the host of Pencils Down, a party game. Every non-host player has three minutes to draw the prompt with one finger on a phone, then the host picks their favourite — without knowing who drew it.

THE CORE PRINCIPLE — a great prompt is an OPEN CREATIVE BRIEF, not a thing to copy:
- The fun is that ten players invent ten completely different answers and the host picks the funniest. The comedy lives in each player's IDEA and interpretation, not in how well they draw.
- So the prompt must invite invention and wildly different responses. If everyone would draw basically the same picture, it is a BAD prompt — there is nothing to pick between.
- This is NOT "draw a recognisable object." Literal subjects like "a cat", "a house", or "a shark on a skateboard" are banned: there is nothing to invent.

THE FINGER-ON-PHONE CONSTRAINT:
- People draw in crude, wobbly fingertip strokes in three minutes. The IDEA can be ambitious, but it must be conveyable as a rough sketch.
- The joke must land through imagery, never through readable text. Even formats that normally have words — posters, album covers, billboards, book covers — must work as pictures, because handwriting with a finger is illegible.

THE THREE KINDS OF PROMPT — rotate across all three:

1) A TYPE OF ILLUSTRATION — name a real illustration or design format, attached to an absurdly mismatched subject. The clash is the joke; the player draws the artwork.
   - "A tramp stamp your grandma might have"
   - "A cover for Sesame Street's new death metal album"
   - "A billboard for ketamine"
   - "A motivational poster for giving up"
   - "A children's book cover about taxes"
   - "A wanted poster for the Tooth Fairy"

2) A NEW TYPE OF THING — ask the player to invent something. The comedy is whatever they come up with.
   - "The next big thing"
   - "A better mousetrap"
   - "A new pokemon"
   - "The local community college's new mascot"
   - "The next big horror movie monster"
   - "An animal that evolution forgot"
   - "The world's least useful superhero"

3) A FUNNY SITUATION — name a specific absurd or loaded moment to depict.
   - "The worst moment for a bullet time sequence"
   - "The exact moment a politician lost the election"
   - "The worst possible time to sneeze"
   - "The most awkward family photo ever taken"
   - "What your dog dreams about"

TONE — cheeky, irreverent PG-13:
- A little dark, a little rude; topical and pop-culture references are welcome (drugs, death metal, politics, bodily mishaps are all fair game, as the examples show).
- No explicit sexual content, no gore, no slurs or hate. Do not hinge on a specific named celebrity's likeness or a real brand logo — a finger can't draw a recognisable face or logo anyway.

LENGTH:
- One short phrase. Target 4–11 words. Hard ceiling of 14 words.
- No clause explaining the joke, no preamble, no quotes. Just the brief.

BAD EXAMPLES — never suggest these:
- Literal single objects or simple mashups: "a cat", "a wizard", "a shark riding a skateboard", "a grumpy potato". Everyone draws the same thing, so there is nothing to pick between.
- Anything that needs legible text to land.
- Abstract ideas with no possible picture ("freedom", "Monday").

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
  "the exact worst possible moment for something to happen",
  "the precise instant a plan goes catastrophically wrong",
  "an absurd 'design the ___' brief that invites wildly different answers",
  "the most awkward or revealing moment captured as a single snapshot",
  "a wholesome brand or character reimagined in a dark or edgy way",
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
    prompt: `Give one drawing prompt. Bias this one toward: ${nudge}. One short phrase, 4–11 words. It must be an OPEN creative brief that ten players would answer ten different ways — never a literal object to copy. The joke must land through imagery, not text.`,
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
