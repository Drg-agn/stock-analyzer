import axios from "axios";

const API = axios.create({
 baseURL: "https://stock-analyzer-backend-q1sy.onrender.com/api",
});

export const analyzeStocks = async (tickers) => {
  const response = await API.post("/analyze", {
    tickers,
  });

  return response.data;
};

export default API;