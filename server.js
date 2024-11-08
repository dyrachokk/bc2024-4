const http = require('http');
const { program } = require('commander');
const fs = require('fs');

program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до кешу');

program.parse(process.argv);
const options = program.opts();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Сервер працює!');
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено на ${options.host}:${options.port}`);
});
