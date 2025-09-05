import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import inviteRoutes from "./routes/inviteRoutes";
import searchRoutes from "./routes/searchRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/invites", inviteRoutes);
app.use("/search", searchRoutes);

app.get("/", (_req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env["PORT"] || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
