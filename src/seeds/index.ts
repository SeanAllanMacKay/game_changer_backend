import { seedDirtyLaundry } from "./dirtyLaundry";
import { seedMakeSomeNoise } from "./makeSomeNoise";
import { seedPencilsDown } from "./pencilsDown";
import { seedRaceToTheBottom } from "./raceToTheBottom";

export type GameTemplateSeed = {
  name: string;
  run: () => Promise<unknown>;
};

export const gameTemplateSeeds: GameTemplateSeed[] = [
  { name: "Dirty Laundry", run: seedDirtyLaundry },
  { name: "Race to the Bottom", run: seedRaceToTheBottom },
  { name: "Make Some Noise", run: seedMakeSomeNoise },
  { name: "Pencils Down", run: seedPencilsDown },
];

export {
  seedDirtyLaundry,
  seedRaceToTheBottom,
  seedMakeSomeNoise,
  seedPencilsDown,
};
