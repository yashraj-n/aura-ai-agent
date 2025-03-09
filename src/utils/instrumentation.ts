import { AISDKExporter } from "langsmith/vercel";
import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

export const sdk = new NodeSDK({
  traceExporter: new AISDKExporter({
    // debug:true,

  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
