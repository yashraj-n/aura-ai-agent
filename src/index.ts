import "dotenv/config";
import "./app.ts";

import path from "path";
import { logger } from "./logger";
import "./utils/instrumentation";
import { indexAndEmbedRepo } from "./utils";
import { generateReview } from "./core/llm/review/index.ts";
import { transformStructural } from "./core/llm/structure/index.ts";
import { ZReviewLLMSchema } from "./types/zod";

logger.debug("Starting the application...");

// const repoPath = path.join(process.cwd(), "sample_project");

// const PATCHES = `--- changed.ts  2025-03-08 15:24:28.848922800 +0000
// +++ cosmetic-scrape.ts  2025-03-08 15:22:39.935792100 +0000
// @@ -1,19 +1,12 @@
//  import { createScraper } from "./scraper-util";
//  // import barcodes from "./cosmetics.json";
//  const barcodes = [
// -  "a","b",
// -  "c","d",
// -  "e"
// +  "a","b"
//  ]

//  async function main() {
// -  const scraper = await createScraper222("./output/cosmetics.json");
// +  const scraper = await createScraper("./output/cosmetics.json");
//    await scraper.processBarcodeList(barcodes as string[]);
// -
// -  for(let i = 0; i < 10; i++) {
// -    await scraper.processBarcodeList(barcodes as string[]);
// -  }
//  }

//  await main().catch(console.error);
// -MediaStreamAudioDestinationNodesd`;

// const threads = [
//     "we need an express server to check the progress of scraping, from scraper-util.ts",
// ];

// const embeddingsData = await indexAndEmbedRepo(repoPath);
// const review = await generateReview(repoPath, PATCHES, embeddingsData);
// console.log("RAW REVIEW", review);

// const structural = await transformStructural(review, ZReviewLLMSchema);
// console.log("STRUCTURAL", structural);
