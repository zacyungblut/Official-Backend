import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import inviteRoutes from "./routes/inviteRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", userRoutes);
app.use("/invites", inviteRoutes);

app.get("/", (_req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env["PORT"] || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
