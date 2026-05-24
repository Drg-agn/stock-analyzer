const express = require("express");
const cors = require("cors");

const analyzeRoutes = require("./routes/analyze.routes");

const app = express();

app.use(cors({
  origin: "*",
}));

app.use(express.json());

app.use("/api/analyze", analyzeRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});