import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const analyzeStocks = async (tickers) => {
  const response = await API.post("/analyze", {
    tickers,
  });

  return response.data;
};

export default API;