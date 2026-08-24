// print-proxy/index.js
const express = require('express');
const net = require('net');

const app = express();
const PORT = 8081;

/**
 * CORS + Chrome Private Network Access fix.
 * Chrome (v94+) sends a preflight with 'Access-Control-Request-Private-Network: true'
 * for any HTTPS→localhost request. We must respond with the matching Allow header.
 */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-IP, X-Printer-Port');
  // This is the critical header Chrome requires for Private Network Access
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    // Preflight response – must return 200/204 quickly
    return res.sendStatus(204);
  }
  next();
});

// Parse raw binary body
app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.post('/print', (req, res) => {
    const printerIp = req.header('X-Printer-IP');
    const printerPort = req.header('X-Printer-Port') || 9100;

    if (!printerIp) {
        return res.status(400).send('Missing X-Printer-IP header');
    }

    const payload = req.body;

    if (!Buffer.isBuffer(payload) || payload.length === 0) {
        return res.status(400).send('Empty or invalid payload');
    }

    console.log(`[PRINT] Received job of ${payload.length} bytes for ${printerIp}:${printerPort}`);

    // Create absolute raw TCP socket
    const client = new net.Socket();

    client.setTimeout(5000); // 5 sec timeout

    client.on('error', (err) => {
        console.error(`[ERROR] Connection to ${printerIp}:${printerPort} failed:`, err.message);
        if (!res.headersSent) {
            res.status(500).send(`Failed to connect to printer: ${err.message}`);
        }
        client.destroy();
    });

    client.on('timeout', () => {
        console.error(`[ERROR] Connection to ${printerIp}:${printerPort} timed out.`);
        if (!res.headersSent) {
            res.status(504).send('Printer connection timed out');
        }
        client.destroy();
    });

    client.connect(printerPort, printerIp, () => {
        console.log(`[CONNECTED] Sending data to ${printerIp}:${printerPort}...`);

        // Send the raw binary ESC/POS commands
        client.write(payload, () => {
            console.log(`[SUCCESS] Data sent successfully to ${printerIp}:${printerPort}`);
            if (!res.headersSent) {
                res.status(200).send('Print job sent successfully');
            }
            // Use end() for a graceful TCP FIN instead of destroy() which sends RST
            // This prevents cheaper printers from hanging port 9100 after multiple prints
            client.end();
        });
    });
});

app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🖨️ Sinver Local Print Proxy `);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log('=================================');
    console.log('Keep this window open while taking orders to enable TCP printing.');
});
