import { createScraper } from "./scraper-util";
// import barcodes from "./cosmetics.json";
const barcodes = [
  "a","b"
]

async function main() {
  const scraper = await createScraper("./output/cosmetics.json");
  await scraper.processBarcodeList(barcodes as string[]);
}

await main().catch(console.error);
