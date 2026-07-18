import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";

const port = Number(process.env.PORT ?? 3000);
const dataFile = process.env.LISTINGS_DATA_FILE ?? "data/listings.json";
const server = createApi({
  repository: new FileListingRepository(dataFile),
});

server.listen(port, () => {
  console.log(`FraldaCycle API listening on port ${port}`);
});
