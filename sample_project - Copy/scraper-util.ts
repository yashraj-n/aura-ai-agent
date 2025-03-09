import * as cheerio from "cheerio";
import axios from "axios";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname, basename } from "path";
import http from "http";
import https from "https";
import pLimit from "p-limit";

const ITEMS_PER_FILE = 10000; //10000
const CONCURRENT_BATCH_SIZE = 500; // 300
const PROGRESS_UPDATE_INTERVAL = 1000; // 1 second
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1339855800595779594/8Y9NUWblrovseUgCkJATvC-lYxhvyjqvf1xPRH-FzPUdEqrqQDvb2F2pCeLlu-U1RS1V";
const WEBHOOK_UPDATE_INTERVAL = 300000; // 5 mins
const BACKUP_INTERVAL = ITEMS_PER_FILE;

type ScrapedItem = {
  barcode: string;
  imageUrl?: string;
  ingredients?: string;
  html?: string;
};

type FailedItem = {
  barcode: string;
  error: string;
};

type ProcessingStats = {
  startTime: number;
  lastUpdateTime: number;
  lastWebhookTime: number;
  requestTimes: number[];
};

type ProgressStats = {
  completed: number;
  total: number;
  successes: number;
  failures: number;
  rate: number;
  avgRequestTime: number;
  eta: number;
  elapsedTime: number;
};

type MetaData = {
  lastProcessedIndex: number;
  successes: number;
  failures: number;
  openFoodFactsSuccesses: number;
  goUpcSuccesses: number;
};

const getProxy = () => {
  return {
    protocol: "http",
    host: "p.webshare.io",
    port: 9999,
  };
};

// Helper function to format milliseconds into hours, minutes, seconds
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

export async function createScraper(outputFileBase: string) {
  // Add latest error tracking
  let latestError: string = "";

  // Create output directory if it doesn't exist
  const outputDir = join(dirname(outputFileBase), "output");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Create backup directory if it doesn't exist
  const backupDir = join(dirname(outputFileBase), "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  function constructOFFUrl(barcode: string, resolution = "full") {
    const baseUrl = "https://images.openfoodfacts.org/images/products";
  
    let folderName = barcode;
    if (folderName.length > 8) {
      folderName = folderName.replace(/(...)(...)(...)(.*)/, "$1/$2/$3/$4");
    }  
    return `${baseUrl}/${folderName}/1.jpg`;
  }

  // Create axios instance with HTTP/HTTPS keep-alive agents
  const axiosInstance = axios.create({
    responseType: "text",
    decompress: true,
    proxy: getProxy(),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept-Encoding": "gzip, deflate, br",
      
    },
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 300000, // 5 minutes timeout
  });

  const noProxyInstance = axios.create({
    decompress: true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept-Encoding": "gzip, deflate, br",
    },
  });
  const baseURL = "https://go-upc.com/search?q=";
  const getBarcodeURL = (barcode: string) => `${baseURL}${barcode}`;

  // File paths
  const metadataPath = `${outputFileBase}.metadata.json`;

  // Process a single barcode
  async function processBarcode(barcode: string): Promise<{
    success: boolean;
    html?: string;
    ingredients?: string;
    imageUrl?: string;
    error?: string;
    source?: "openfoodfacts" | "go-upc";
  }> {
    // First try OpenFoodFacts
    try {
      const url = constructOFFUrl(barcode);
      const response = await noProxyInstance.get(url);

      if (response.status === 200) {
        return {
          success: true,
          html: "",
          imageUrl: url,
          source: "openfoodfacts"
        };
      }
    } catch (error) {
      // Silently continue to go-upc if OpenFoodFacts fails
    }

    // Try go-upc as fallback
    try {
      const url = getBarcodeURL(barcode);
      const response = await axiosInstance.get(url);
      
      if (!response.data) {
        throw new Error("Empty response from go-upc");
      }

      const $ = cheerio.load(response.data);
      
      // Find product image - using more specific selector
      const imageUrl = $('img[src*="go-upc.s3.amazonaws.com"]').first().attr('src');
      
      if (!imageUrl) {
        throw new Error("No product image found");
      }

      // Extract ingredients with improved selector chain
      const ingredients = $([
        'div[class*="main"] div:contains("Ingredients")',
        'div[class*="ingredients"]',
        'div:contains("Ingredients")'
      ].join(','))
        .first()
        .text()
        .trim()
        .replace(/^Ingredients:?\s*/i, '')
        .trim();

      return {
        success: true,
        html: response.data,
        ingredients,
        imageUrl,
        source: "go-upc"
      };

    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Unknown error occurred";
      
      latestError = `Error processing barcode ${barcode}: ${errorMessage}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Resume point function with enhanced metadata
  function findResumePoint(): {
    index: number;
    successes: number;
    failures: number;
    openFoodFactsSuccesses: number;
    goUpcSuccesses: number;
  } {
    if (existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(
          readFileSync(metadataPath, "utf8")
        ) as MetaData;
        return {
          index: metadata.lastProcessedIndex,
          successes: metadata.successes || 0,
          failures: metadata.failures || 0,
          openFoodFactsSuccesses: metadata.openFoodFactsSuccesses || 0,
          goUpcSuccesses: metadata.goUpcSuccesses || 0,
        };
      } catch (error) {
        console.error("Error reading metadata file:", error);
        return {
          index: -1,
          successes: 0,
          failures: 0,
          openFoodFactsSuccesses: 0,
          goUpcSuccesses: 0,
        };
      }
    }
    return {
      index: -1,
      successes: 0,
      failures: 0,
      openFoodFactsSuccesses: 0,
      goUpcSuccesses: 0,
    };
  }

  // Save metadata with success/failure counts
  function saveMetadata(
    lastProcessedIndex: number,
    successes: number,
    failures: number,
    openFoodFactsSuccesses: number,
    goUpcSuccesses: number
  ) {
    const metadata: MetaData = {
      lastProcessedIndex,
      successes,
      failures,
      openFoodFactsSuccesses,
      goUpcSuccesses,
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // Save batch of results to file
  function saveBatchToFile(
    successItems: ScrapedItem[],
    failedItems: FailedItem[],
    currentIndex: number
  ) {
    if (successItems.length === 0 && failedItems.length === 0) return;

    const fileIndex = Math.floor(currentIndex / ITEMS_PER_FILE);

    const successFilePath = join(outputDir, `successes_${fileIndex}.json`);
    const failFilePath = join(outputDir, `fails_${fileIndex}.json`);

    // Load existing data if files exist
    let existingSuccesses: ScrapedItem[] = [];
    let existingFails: FailedItem[] = [];

    if (existsSync(successFilePath)) {
      try {
        existingSuccesses = JSON.parse(readFileSync(successFilePath, "utf8"));
      } catch (error) {
        console.error(`Error reading ${successFilePath}:`, error);
      }
    }

    if (existsSync(failFilePath)) {
      try {
        existingFails = JSON.parse(readFileSync(failFilePath, "utf8"));
      } catch (error) {
        console.error(`Error reading ${failFilePath}:`, error);
      }
    }

    // Merge new items with existing ones
    const mergedSuccesses = [...existingSuccesses, ...successItems];
    const mergedFails = [...existingFails, ...failedItems];

    // Save updated files
    writeFileSync(successFilePath, JSON.stringify(mergedSuccesses, null, 2));
    writeFileSync(failFilePath, JSON.stringify(mergedFails, null, 2));
  }

  // Create backup of the current output files
  function createBackup(index: number) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupBaseName = `${basename(
        outputFileBase
      )}_${index}_${timestamp}`;

      // Copy metadata file
      if (existsSync(metadataPath)) {
        const backupMetadataPath = join(
          backupDir,
          `${backupBaseName}_metadata.json`
        );
        writeFileSync(backupMetadataPath, readFileSync(metadataPath));
      }

      // Determine which files to backup based on current progress
      const lastFileIndex = Math.floor(index / ITEMS_PER_FILE);

      for (let i = 0; i <= lastFileIndex; i++) {
        const successFilePath = join(outputDir, `successes_${i}.json`);
        const failFilePath = join(outputDir, `fails_${i}.json`);

        if (existsSync(successFilePath)) {
          const backupSuccessPath = join(
            backupDir,
            `${backupBaseName}_successes_${i}.json`
          );
          writeFileSync(backupSuccessPath, readFileSync(successFilePath));
        }

        if (existsSync(failFilePath)) {
          const backupFailPath = join(
            backupDir,
            `${backupBaseName}_fails_${i}.json`
          );
          writeFileSync(backupFailPath, readFileSync(failFilePath));
        }
      }

      console.log(`Backup created at ${backupDir}/${backupBaseName}_*.json`);
    } catch (error) {
      console.error(`Failed to create backup: ${error}`);
    }
  }

  // Send a progress update to Discord (fire-and-forget)
  async function sendProgressWebhook(stats: ProgressStats) {
    try {
      const percentComplete = Math.round((stats.completed / stats.total) * 100);
      const successRate =
        Math.round((stats.successes / stats.completed) * 100) || 0;

      const fields = [
        {
          name: "Progress",
          value: `${stats.completed.toLocaleString()}/${stats.total.toLocaleString()} (${percentComplete}%)`,
          inline: true,
        },
        { name: "Success Rate", value: `${successRate}%`, inline: true },
        {
          name: "Processing Speed",
          value: `${stats.rate.toFixed(
            1
          )} items/sec\nAvg Time: ${stats.avgRequestTime.toFixed(0)}ms`,
          inline: true,
        },
        {
          name: "Results",
          value: `✅ ${stats.successes.toLocaleString()} successful\n❌ ${stats.failures.toLocaleString()} failed`,
          inline: true,
        },
        {
          name: "Time",
          value: `Elapsed: ${formatTime(stats.elapsedTime)}\nETA: ${formatTime(
            stats.eta * 1000
          )}`,
          inline: true,
        },
      ];

      // Add error field if there's a latest error
      if (latestError) {
        fields.push({
          name: "Latest Error",
          value: latestError.substring(0, 1024), // Discord has a 1024 char limit for field values
          inline: false,
        });
      }

      const embed = {
        title: `Scraping Progress - ${basename(outputFileBase)}`,
        color: 0x00ff00,
        fields,
        timestamp: new Date().toISOString(),
      };

      // Note: we don't await this post in our main loop.
      axiosInstance
        .post(DISCORD_WEBHOOK_URL, { embeds: [embed] })
        .catch((err) => console.error("Failed to send Discord webhook:", err));
    } catch (error) {
      console.error("Failed to send Discord webhook:", error);
    }
  }

  // Process a list of barcodes with p-limit for controlled concurrency
  async function processBarcodeList(barcodeList: string[]) {
    const total = barcodeList.length;
    const resumeData = findResumePoint();
    let startIndex = resumeData.index >= 0 ? resumeData.index + 1 : 0;
    let successes = resumeData.successes;
    let failures = resumeData.failures;
    let openFoodFactsSuccesses = resumeData.openFoodFactsSuccesses;
    let goUpcSuccesses = resumeData.goUpcSuccesses;

    // Add message about resume point
    if (resumeData.index >= 0) {
      console.log(
        `Resuming from index ${resumeData.index} (Successes: ${successes}, Failures: ${failures})`
      );
    }

    console.log(
      `Processing ${
        total - startIndex
      } barcodes with concurrency: ${CONCURRENT_BATCH_SIZE}...`
    );

    let completed = startIndex;
    const stats: ProcessingStats = {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      lastWebhookTime: Date.now(),
      requestTimes: [],
    };

    // Initialize p-limit with the desired concurrency
    const limit = pLimit(CONCURRENT_BATCH_SIZE);

    // Buffer for collecting results before saving
    let successItems: ScrapedItem[] = [];
    let failedItems: FailedItem[] = [];
    let lastSavedIndex = startIndex - 1;
    let lastBackupIndex =
      Math.floor(startIndex / BACKUP_INTERVAL) * BACKUP_INTERVAL;

    // Function to update progress display
    const updateProgress = () => {
      const now = Date.now();
      if (now - stats.lastUpdateTime >= PROGRESS_UPDATE_INTERVAL) {
        const elapsed = now - stats.startTime;
        const rate = completed / (elapsed / 1000);
        const remaining = total - completed;
        const eta = remaining / rate;
        const recentTimes = stats.requestTimes.slice(-1000);
        const avgRequestTime =
          recentTimes.length > 0
            ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
            : 0;

        process.stdout.write("\x1B[2K\r");
        process.stdout.write(
          `Progress: ${completed}/${total} (${Math.round(
            (completed / total) * 100
          )}%) | ✅ ${successes} (OFF: ${openFoodFactsSuccesses}, GO-UPC: ${goUpcSuccesses}) ❌ ${failures} | ` +
            `Rate: ${rate.toFixed(1)}/sec | Avg Time: ${avgRequestTime.toFixed(
              0
            )}ms | ETA: ${formatTime(eta * 1000)}`
        );

        if (now - stats.lastWebhookTime >= WEBHOOK_UPDATE_INTERVAL) {
          sendProgressWebhook({
            completed,
            total,
            successes,
            failures,
            rate,
            avgRequestTime,
            eta,
            elapsedTime: elapsed,
          });
          stats.lastWebhookTime = now;
        }
        stats.lastUpdateTime = now;
      }
    };

    // Function to handle saving results and updating metadata
    const saveResults = (index: number, force = false) => {
      if (
        (successItems.length + failedItems.length >= 100 || force) &&
        (successItems.length > 0 || failedItems.length > 0)
      ) {
        saveBatchToFile(successItems, failedItems, index);
        saveMetadata(
          index,
          successes,
          failures,
          openFoodFactsSuccesses,
          goUpcSuccesses
        );
        lastSavedIndex = index;

        // Clear buffers after saving
        successItems = [];
        failedItems = [];
      }
    };

    // Function to check if backup is needed
    const checkBackup = (index: number) => {
      const currentBackupThreshold =
        Math.floor(index / BACKUP_INTERVAL) * BACKUP_INTERVAL;
      if (
        currentBackupThreshold > lastBackupIndex &&
        lastSavedIndex >= index - 100
      ) {
        process.stdout.write("\n");
        console.log(`Batch complete at ${index}/${total}. Creating backup...`);
        createBackup(index);
        lastBackupIndex = currentBackupThreshold;
        return true;
      }
      return false;
    };

    // Process all remaining barcodes with controlled concurrency
    const tasks = barcodeList.slice(startIndex).map((barcode, idx) => {
      const currentIndex = startIndex + idx;
      return limit(async () => {
        const startTime = Date.now();
        const result = await processBarcode(barcode);
        const time = Date.now() - startTime;

        // Update stats atomically
        if (result.success) {
          successes++;
          if (result.source === "openfoodfacts") {
            openFoodFactsSuccesses++;
          } else if (result.source === "go-upc") {
            goUpcSuccesses++;
          }
          successItems.push({
            barcode,
            imageUrl: result.imageUrl,
            ingredients: result.ingredients,
            html: result.html,
          });
        } else {
          failures++;
          failedItems.push({ barcode, error: result.error! });
        }

        completed++;
        stats.requestTimes.push(time);

        // Update progress display
        updateProgress();

        // Save results if needed
        saveResults(currentIndex);

        // Check if backup is needed
        if (checkBackup(currentIndex)) {
          updateProgress(); // Force update after backup message
        }

        return { index: currentIndex };
      });
    });

    try {
      // Process all tasks and wait for completion
      await Promise.all(tasks);

      // Final save for any remaining items
      saveResults(total - 1, true);

      // Final backup
      if (completed > lastSavedIndex && completed > lastBackupIndex) {
        createBackup(completed - 1);
      }

      // Final webhook update
      const finalElapsed = Date.now() - stats.startTime;
      const overallAvgTime =
        stats.requestTimes.length > 0
          ? stats.requestTimes.reduce((a, b) => a + b, 0) /
            stats.requestTimes.length
          : 0;
      sendProgressWebhook({
        completed,
        total,
        successes,
        failures,
        rate: completed / (finalElapsed / 1000),
        avgRequestTime: overallAvgTime,
        eta: 0,
        elapsedTime: finalElapsed,
      });

      console.log("\n\nCompleted!");
      console.log(`✅ Successful: ${successes} ❌ Failed: ${failures}`);
      console.log(`Total time: ${formatTime(finalElapsed)}`);
      console.log(`Average request time: ${overallAvgTime.toFixed(0)}ms`);
    } catch (error) {
      latestError = `Fatal error during processing: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error("\n" + latestError);

      // Save current progress
      saveResults(lastSavedIndex + 1, true);
      createBackup(lastSavedIndex + 1);

      throw error;
    }
  }

  return { processBarcodeList };
}
