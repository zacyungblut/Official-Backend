import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/users", userRoutes);

app.get("/", (_req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env["PORT"] || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
