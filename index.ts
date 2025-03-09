import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama, ollama } from "ollama-ai-provider";
import { createMistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";

// Logging system
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

// Global logger instance
const logger = new Logger(LogLevel.DEBUG);

const model = createOpenRouter({
  apiKey:
    "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",
})
// ("google/gemini-2.0-pro-exp-02-05:free");
("google/gemini-2.0-flash-exp:free");

// const model = createMistral({
//   apiKey: "K9IkAk6ZdMkdh1r3bAKZGlfUpOmkYLTQ",
// })("mistral-large-latest");

const PROMPT = `
You will act as an expert software architect. You will be given a chat thread where users discuss a code issue or feature request. Your job is to generate a concise, structured, and actionable implementation plan based on the given information.
Key Requirements:

    1. Run the necessary functions first to gather context before generating the plan.
    2. The plan should be strictly an outline—no explanations, no reasoning, no code snippets.
    3. Clearly specify:
        - Which files need to be modified.
        - What changes need to be made in each file.
    *The output should be in a step-by-step outline format (e.g., numbered list)*.

Available Tool Functions:

    1. ReadFile(path: string): string → Reads the content of a file.
    2. ReadDirectory(path: string): string[] → Returns a list of files and directories inside a given directory (use "." for the current directory).
    3. GetAllFiles(path: string): string[] → Returns a list of all files inside a given directory and its subdirectories.

Process:

    1. Analyze the chat thread to identify the issue or feature request.
    2. Use the functions to inspect the codebase:

    - Call ReadDirectory(".") or GetAllFiles(".") to locate relevant files.
    - Call ReadFile(path) on relevant files to understand their structure and content.

    3. Generate a strictly formatted outline for the required changes:

    - List specific files to be modified.
    - List step-by-step modifications for each file.
    - Ensure the plan remains concise and purely instructional (no explanations or justifications).
`;

class ToolCallHandler {
  private readonly projectPath = path.join(process.cwd(), "sample_project");

  async readFileContents(_filePath: string): Promise<string> {
    logger.debug(`Reading file: ${_filePath}`);
    try {
      const filePath = path.join(this.projectPath, _filePath);
      const content = await fs.readFile(filePath, "utf8");
      logger.debug(`File read complete: ${_filePath}`);
      return content;
    } catch (error: unknown) {
      const errorMessage = `Error reading file '${_filePath}': ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(errorMessage);
      return `ERROR: ${errorMessage}`;
    }
  }

  async readDirectory(_path: string): Promise<string[]> {
    logger.debug(`Reading directory: ${_path}`);
    try {
      const filePath = path.join(this.projectPath, _path);
      const files = await fs.readdir(filePath);
      logger.debug(
        `Directory read complete: ${_path}, found ${files.length} files`
      );
      return files;
    } catch (error: unknown) {
      const errorMessage = `Error reading directory '${_path}': ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(errorMessage);
      return [`ERROR: ${errorMessage}`];
    }
  }

  async getAllFiles(_path: string) {
    logger.debug(`Getting all files in: ${_path}`);
    try {
      const filePath = path.join(this.projectPath, _path);
      const files = await fs.readdir(filePath);
      logger.debug(`Found ${files.length} files in directory: ${_path}`);
      const fileContents = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.projectPath, _path, file);
          logger.debug(`Reading file content: ${file}`);
          try {
            const content = await fs.readFile(filePath, "utf8");
            return { filename: file, content };
          } catch (fileError: unknown) {
            const errorMessage = `Error reading file '${file}': ${
              fileError instanceof Error ? fileError.message : String(fileError)
            }`;
            logger.error(errorMessage);
            return {
              filename: file,
              content: `ERROR: Could not read file '${file}': ${errorMessage}`,
            };
          }
        })
      );
      logger.debug(`All files read complete in: ${_path}`);
      return fileContents;
    } catch (error: unknown) {
      const errorMessage = `Error processing directory '${_path}': ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(errorMessage);
      return [{ filename: _path, content: `ERROR: ${errorMessage}` }];
    }
  }
}
const txt = await generateText({
  model: model,
  system: PROMPT,
  messages: [
    {
      role: "user",
      content: "Create express server checking the progress of scraping",
    },
  ],
  tools: {
    ReadFile: {
      description: "Reads the contents of a file.",
      parameters: z.object({
        path: z.string().describe("Path to the file."),
      }),
      execute: async ({ path }: { path: string }) => {
        logger.info(`Tool called: ReadFile(${path})`);
        return await new ToolCallHandler().readFileContents(path);
      },
    },
    ReadDirectory: {
      description: "Lists all files in a directory.",
      parameters: z.object({
        path: z.string().describe("Path to the directory."),
      }),
      execute: async ({ path }: { path: string }) => {
        logger.info(`Tool called: ReadDirectory(${path})`);
        return await new ToolCallHandler().readDirectory(path);
      },
    },
    GetAllFiles: {
      description: "Gets content of all files in a directory.",
      parameters: z.object({
        path: z.string().describe("Path to the directory."),
      }),
      execute: async ({ path }: { path: string }) => {
        logger.info(`Tool called: GetAllFiles(${path})`);
        return await new ToolCallHandler().getAllFiles(path);
      },
    },
  },
  toolChoice: "auto",
  maxSteps: 1000,
  onStepFinish: (stepResult) => {
    console.log("Step Res", stepResult.text);
  },
});

logger.info("Generation complete");
console.log(txt.text);
