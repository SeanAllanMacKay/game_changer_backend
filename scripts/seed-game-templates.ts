import { gameTemplateSeeds } from "../src/seeds";

async function main() {
  let failed = 0;
  for (const seed of gameTemplateSeeds) {
    process.stdout.write(`seeding '${seed.name}'... `);
    try {
      await seed.run();
      console.log("OK");
    } catch (err: any) {
      failed++;
      console.log("FAIL");
      console.error(`  -> ${err?.message ?? err}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} seed(s) failed.`);
    process.exit(1);
  }
  console.log(`\nseeded ${gameTemplateSeeds.length} game template(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
