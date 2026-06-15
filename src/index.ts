import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import eventsRouter from "./routes/events";

dotenv.config();

const REQUIRED_ENV = ["STELLAR_RPC_URL", "NOVA_EVENTS_CONTRACT_ID"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/events", eventsRouter);

app.listen(PORT, () => {
  console.log(`NovaEvents API running on port ${PORT}`);
});

export default app;
