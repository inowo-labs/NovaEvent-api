import { NextFunction, Request, Response } from "express";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    // Update header with the final elapsed time once the response is complete
    res.setHeader("X-Response-Time", `${ms}ms`);
    console.log(`${req.method} ${req.path} ${res.statusCode} — ${ms}ms`);
  });

  // Set an initial value before next() so the header is present on all responses,
  // including those that bypass the finish event (e.g. early exits)
  res.setHeader("X-Response-Time", `${Date.now() - start}ms`);
  next();
}
