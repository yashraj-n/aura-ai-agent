import winston from "winston";
const { combine, timestamp, json, printf, colorize, align } = winston.format;

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
        colorize({ all: true }),
        align(),
        printf((info) => `${info.level}: ${info.message}`)
    ),
    transports: [new winston.transports.Console()],
});

