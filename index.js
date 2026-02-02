import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoute from "./routes/auth.route.js";
import { router as departmentRoute } from "./routes/department.route.js";
import { router as dashboardRoute } from "./routes/dashboard.route.js";
import { router as showRoute } from "./routes/show.route.js";
import { router as scheduleRoute } from "./routes/schedule.route.js";
import { router as genresRoute } from "./routes/genres.route.js";
import { router as accountsRoute } from "./routes/accounts.route.js";
import { router as notifcationRouter } from "./routes/notification.route.js";
import { router as ticketPricingRouter } from "./routes/ticketprice.route.js";
import { router as customerRoute } from "./routes/customer.route.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.type("text").send("OK");
});

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/accounts", accountsRoute);
app.use("/api/department", departmentRoute);
app.use("/api/show", showRoute);
app.use("/api/schedule", scheduleRoute);
app.use("/api/genres", genresRoute);
app.use("/api/pricing", ticketPricingRouter);
app.use("/api/notification", notifcationRouter);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/customer", customerRoute);

app.get("/", (req, res) => {
  res.send("Server Documentation Soon");
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port:${PORT}`);
});
