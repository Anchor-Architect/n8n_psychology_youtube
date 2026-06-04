/**
 * Route table for the render engine.
 *   POST /render            enqueue a render job
 *   GET  /status/:jobId     queued | processing | rendering | completed | failed (+ progress)
 *   GET  /result/:jobId     final videoPath + duration when completed
 *   GET  /health            liveness + queue snapshot
 */
import { Router } from "express";
import {
  postRender,
  getStatus,
  getResult,
  getHealth,
} from "../controllers/renderController.js";

export const router = Router();

router.get("/health", getHealth);
router.post("/render", postRender);
router.get("/status/:jobId", getStatus);
router.get("/result/:jobId", getResult);
