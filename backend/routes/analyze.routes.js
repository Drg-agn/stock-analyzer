const router = require("express").Router();
const { analyzeStocks } = require("../controllers/analyze.controller");

router.post("/", analyzeStocks);

module.exports = router;