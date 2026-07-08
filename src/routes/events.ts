import { Router, Request, Response, NextFunction } from "express";
import { xdr } from "@stellar/stellar-sdk";
import rateLimit from "express-rate-limit";
import { simulateContractCall } from "../lib/stellar";
import { validateEventId } from "../middleware/validateEventId";

const router = Router();

// Stricter limiter for GET /api/events — fans out N RPC simulations
const eventsListLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

router.get("/", eventsListLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = (await simulateContractCall("event_count")) as number;
    const events = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        simulateContractCall("get_event", xdr.ScVal.scvU32(i)).then((e) => ({
          id: i,
          ...(e as object),
        }))
      )
    );
    res.json(serializeBigInt(events));
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const event = await simulateContractCall(
        "get_event",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(event));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("event not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/:id/status",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const event = await simulateContractCall("get_event", xdr.ScVal.scvU32(id)) as any;
      res.json({ event_id: id, status: Object.keys(event.status)[0] });
    } catch (err: any) {
      if (err.message?.includes("event not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

// New: return only the organizer address for an event
router.get(
  "/:id/organizer",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const event = await simulateContractCall(
        "get_event",
        xdr.ScVal.scvU32(id)
      );
      // reuse serializer to handle bigint conversion if present
      const serialized = serializeBigInt(event) as any;
      res.json({ event_id: id, organizer: String(serialized.organizer) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("event not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/:id/tiers",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const tiers = await simulateContractCall(
        "get_tiers",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(tiers));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("tiers not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/:id/sponsorships",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const sponsorships = await simulateContractCall(
        "get_sponsorships",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(sponsorships));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/ticket-count",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const count = await simulateContractCall(
        "ticket_count",
        xdr.ScVal.scvU32(id)
      );
      res.json({ event_id: id, ticket_count: Number(count) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/tickets/:ticketId",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId < 0) {
      res.status(400).json({ error: "ticket id must be a non-negative integer" });
      return;
    }
    try {
      const id = Number(req.params.id);
      const ticket = await simulateContractCall(
        "get_ticket",
        xdr.ScVal.scvU32(id),
        xdr.ScVal.scvU32(ticketId)
      );
      res.json(serializeBigInt(ticket));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("ticket not found")) {
        res.status(404).json({ error: "ticket not found" });
      } else {
        next(err);
      }
    }
  }
);

function serializeBigInt(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeBigInt(v),
      ])
    );
  }
  return value;
}

export default router;
