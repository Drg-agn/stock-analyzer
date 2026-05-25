import axios from "axios";

// Directly use the deployed Render backend URL
const API_BASE_URL = "https://stock-analyzer-backend-q1sy.onrender.com/api";

const API = axios.create({
  baseURL: API_BASE_URL,
});

export const analyzeStocks = async (tickers) => {
  const response = await API.post("/analyze", { tickers });
  return response.data;
};

export default API;