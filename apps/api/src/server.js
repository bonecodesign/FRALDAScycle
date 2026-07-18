import { createApi } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const server = createApi();

server.listen(port, () => {
  console.log(`FraldaCycle API listening on port ${port}`);
});
