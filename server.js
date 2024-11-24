const { program } = require("commander");
const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const superagent = require("superagent");

program
  .requiredOption("-h, --host <host>")
  .requiredOption("-p, --port <port>")
  .requiredOption("-c, --cache <cache>")
  .parse();

const options = program.opts();

// Перевірка валідності хоста
if (!/^([a-zA-Z0-9.-]+|\*)$/.test(options.host)) {
  console.error("Host must be a valid hostname or IP address.");
  process.exit(1);
}

// Перевірка валідності порту
const port = parseInt(options.port, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error("Port must be an integer between 1 and 65535.");
  process.exit(1);
}

// Підготовка шляху до кешу
const cacheDir = path.resolve(options.cache);
fs.mkdir(cacheDir, { recursive: true })
  .then(() => console.log(`Cache directory ready: ${cacheDir}`))
  .catch((err) => {
    console.error("Error creating cache directory:", err);
    process.exit(1);
  });

// Функція для завантаження зображень з http.cat
async function fetchImageFromHttpCat(statusCode) {
  const url = `https://http.cat/${statusCode}`;
  try {
    const response = await superagent.get(url);
    return response.body;
  } catch (err) {
    console.error(`Error fetching from https://http.cat`);
    return null;
  }
}

// Обробка запиту GET
async function handleGet(req, res, statusCode) {
  const imagePath = path.join(cacheDir, `${statusCode}.jpg`);
  try {
    const image = await fs.readFile(imagePath);
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(image);
  } catch (err) {
    if (err.code === "ENOENT") {
      const imageBuffer = await fetchImageFromHttpCat(statusCode);
      if (imageBuffer) {
        await fs.writeFile(imagePath, imageBuffer);
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(imageBuffer);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    } else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
}

// Обробка запиту PUT
async function handlePut(req, res, statusCode) {
  const imagePath = path.join(cacheDir, `${statusCode}.jpg`);
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const imageBuffer = Buffer.concat(chunks);
    try {
      await fs.writeFile(imagePath, imageBuffer);
      res.writeHead(201, { "Content-Type": "text/plain" });
      res.end("Created");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });
}

// Обробка запиту DELETE
async function handleDelete(req, res, statusCode) {
  const imagePath = path.join(cacheDir, `${statusCode}.jpg`);
  try {
    await fs.unlink(imagePath);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Deleted");
  } catch (err) {
    if (err.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
}

// Створення сервера
const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split("/");
  const statusCode = urlParts[1];

  // Перевірка, чи код статусу є тризначним числом
  if (!/^\d{3}$/.test(statusCode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not Found");
  }

  // Обробка методів HTTP
  switch (req.method) {
    case "GET":
      await handleGet(req, res, statusCode);
      break;
    case "PUT":
      await handlePut(req, res, statusCode);
      break;
    case "DELETE":
      await handleDelete(req, res, statusCode);
      break;
    default:
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      break;
  }
});

// Запуск сервера
server.listen(port, options.host, () => {
  console.log(`Server started on http://${options.host}:${port}`);
});
