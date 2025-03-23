const express = require("express");
const app = express();
const httpProxy = require("http-proxy");
const proxy = httpProxy.createProxy();

const PORT = 8000;

const BASE_PATH = "https://vercel-main.s3.ap-south-1.amazonaws.com/__outputs/";

app.use((req, res) => {
  const hostName = req.hostname;
  const subDomain = hostName.split(".")[0];
  const resolvesTo = `${BASE_PATH}${subDomain}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const path = req.url;
  if (path === "/") {
    proxyReq.path += "index.html";
  }
});

app.listen(PORT, () => {
  console.log(`Reverse proxy running: ${PORT}`);
});
