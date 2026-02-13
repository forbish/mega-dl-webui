import http from "node:http";

const req = http.get("http://localhost:8080/api/health", (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on("error", () => process.exit(1));
req.setTimeout(4000, () => {
  req.destroy();
  process.exit(1);
});
