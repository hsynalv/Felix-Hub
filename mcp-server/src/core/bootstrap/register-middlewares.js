import express from "express";
import cors from "cors";
import morgan from "morgan";

/**
 * CORS, body parsers, and trust proxy for the Express app.
 * @param {import("express").Express} app
 */
export function registerBaseMiddleware(app) {
  if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (corsOrigins) {
    const originList = corsOrigins.split(",").map((s) => s.trim()).filter(Boolean);
    app.use(cors({ origin: originList.length === 1 ? originList[0] : originList }));
  } else if (process.env.NODE_ENV !== "production") {
    app.use(cors());
  }

  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}
