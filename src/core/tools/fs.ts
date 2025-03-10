import type { Tool } from "ai";
import fs from "fs/promises";
import { z } from "zod";
import path from "path";
import { logger } from "../../logger";

export class ToolCallManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private joinPath(filePath: string): string {
    return path.join(this.basePath, filePath);
  }

  public ReadFile: Tool = {
    description: "Reads a file and returns the content",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to read, relative to base directory"),
    }),
    execute: async ({ path: filePath }) => {
      logger.debug(`Reading file: ${filePath}`);
      try {
        const fullPath = this.joinPath(filePath);
        const content = await fs.readFile(fullPath, "utf-8");
        logger.debug(`Successfully read file: ${filePath}`);
        return content;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error reading file ${filePath}: ${err.message}`);
        return `Error: Failed to read file - ${err.message}`;
      }
    },
  };

  public ReadDirectory: Tool = {
    description: "Reads a directory and returns the content",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path to the directory to read, relative to base directory"
        ),
    }),
    execute: async ({ path: dirPath }) => {
      logger.debug(`Reading directory: ${dirPath}`);
      try {
        const fullPath = this.joinPath(dirPath);
        const content = await fs.readdir(fullPath);
        logger.debug(`Successfully read directory: ${dirPath}, found ${content.length} entries`);
        return content;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error reading directory ${dirPath}: ${err.message}`);
        return `Error: Failed to read directory - ${err.message}`;
      }
    },
  };

  public GetAllFiles: Tool = {
    description: "Gets all files in a directory and its subdirectories",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path to the directory to get all files from, relative to base directory"
        ),
    }),
    execute: async ({ path: dirPath }) => {
      logger.debug(`Getting all files from directory: ${dirPath}`);
      try {
        const fullPath = this.joinPath(dirPath);
        const files = await fs.readdir(fullPath, { withFileTypes: true });
        logger.debug(`Found ${files.length} entries in ${dirPath}`);
        const fileContents = await Promise.all(
          files.map(async (file) => {
            logger.debug(`Processing file: ${file.name}`);
            try {
              const filePath = path.join(fullPath, file.name);
              const content = await fs.readFile(filePath, "utf-8");
              return { filename: file.name, content };
            } catch (error) {
              const err = error as Error;
              logger.error(`Error reading file ${file.name}: ${err.message}`);
              return { filename: file.name, content: `Error: ${err.message}` };
            }
          })
        );
        logger.debug(`Completed processing all files in ${dirPath}`);
        return fileContents;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error getting all files from ${dirPath}: ${err.message}`);
        return `Error: Failed to get files - ${err.message}`;
      }
    },
  };

  public CreateDirectory: Tool = {
    description: "Creates a directory (non-recursive)",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path to the directory to create, relative to base directory"
        ),
    }),
    execute: async ({ path: dirPath }) => {
      logger.debug(`Creating directory: ${dirPath}`);
      try {
        const fullPath = this.joinPath(dirPath);
        await fs.mkdir(fullPath, { recursive: false });
        logger.debug(`Successfully created directory: ${dirPath}`);
        return `Directory created: ${fullPath}`;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error creating directory ${dirPath}: ${err.message}`);
        return `Error: Failed to create directory - ${err.message}`;
      }
    },
  };

  public CreateFile: Tool = {
    description: "Creates a file",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to create, relative to base directory"),
      content: z.string().describe("The content of the file to create"),
    }),
    execute: async ({ path: filePath, content }) => {
      logger.debug(`Creating file: ${filePath}`);
      try {
        const fullPath = this.joinPath(filePath);
        await fs.writeFile(fullPath, content);
        logger.debug(`Successfully created file: ${filePath}`);
        return `File created: ${fullPath}`;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error creating file ${filePath}: ${err.message}`);
        return `Error: Failed to create file - ${err.message}`;
      }
    },
  };

  public WriteFile: Tool = {
    description: "Writes a file",
    parameters: z.object({
      path: z.string().describe("The path to the file to write, relative to base directory"),
      content: z.string().describe("The content of the file to write"),
    }),
    execute: async ({ path: filePath, content }) => {
      logger.debug(`Writing file: ${filePath}`);
      try {
        const fullPath = this.joinPath(filePath);
        logger.debug(`Writing file to: ${fullPath}`);
        await fs.writeFile(fullPath, content);
        logger.debug(`Successfully wrote file: ${filePath}`);
        return `File written: ${fullPath}`;
      } catch (error) {
        const err = error as Error;
        logger.error(`Error writing file ${filePath}: ${err.message}`);
        return `Error: Failed to write file - ${err.message}`;
      }
    },
  };
}
