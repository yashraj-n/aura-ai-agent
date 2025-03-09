import "dotenv/config";

import path from "path";
import { logger } from "./logger";
import { generateReview } from "./core/review";

logger.debug("Starting the application...");

const repoPath = path.join(process.cwd(), "sample_project");

const PATCHES = `--- changed.ts  2025-03-08 15:24:28.848922800 +0000
+++ cosmetic-scrape.ts  2025-03-08 15:22:39.935792100 +0000
@@ -1,19 +1,12 @@
 import { createScraper } from "./scraper-util";
 // import barcodes from "./cosmetics.json";
 const barcodes = [
-  "a","b",
-  "c","d",
-  "e"
+  "a","b"
 ]

 async function main() {
-  const scraper = await createScraper222("./output/cosmetics.json");
+  const scraper = await createScraper("./output/cosmetics.json");
   await scraper.processBarcodeList(barcodes as string[]);
-
-  for(let i = 0; i < 10; i++) {
-    await scraper.processBarcodeList(barcodes as string[]);
-  }
 }

 await main().catch(console.error);
-MediaStreamAudioDestinationNodesd`

const review = await generateReview(repoPath, PATCHES);
console.log("Review: ", review);

// const threads = ["we need an express server to check the progress of scraping"];

// const plan = await generatePlan(repoPath, threads);
// console.log(plan);

// process.on("exit", async () => {
//   logger.info("Shutting down the application...");
//   await sdk.shutdown();
// });
