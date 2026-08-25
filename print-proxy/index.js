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

// Queue system to prevent concurrent connections to the same printer
const printQueues = {};

app.post('/print', async (req, res) => {
    const printerIp = req.header('X-Printer-IP');
    const printerPort = req.header('X-Printer-Port') || 9100;

    if (!printerIp) return res.status(400).send('Missing X-Printer-IP header');

    const payload = req.body;
    if (!Buffer.isBuffer(payload) || payload.length === 0) {
        return res.status(400).send('Empty or invalid payload');
    }

    console.log(`[PRINT] Received job of ${payload.length} bytes for ${printerIp}:${printerPort}`);

    // Initialize queue for this IP if it doesn't exist
    if (!printQueues[printerIp]) {
        printQueues[printerIp] = Promise.resolve();
    }

    // Enqueue the print job
    printQueues[printerIp] = printQueues[printerIp].then(() => {
        return new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(5000); // 5 sec timeout

            let finished = false;
            const finish = (err, statusCode, msg) => {
                if (finished) return;
                finished = true;
                if (!res.headersSent) res.status(statusCode).send(msg);
                if (!client.destroyed) client.destroy();
                // Add a small 1-second delay before resolving to let the printer clear its internal buffer
                setTimeout(resolve, 1000); 
            };

            client.on('error', (err) => {
                console.error(`[ERROR] Connection to ${printerIp}:${printerPort} failed:`, err.message);
                finish(err, 500, `Failed to connect to printer: ${err.message}`);
            });

            client.on('timeout', () => {
                console.error(`[ERROR] Connection to ${printerIp}:${printerPort} timed out.`);
                finish(new Error('Timeout'), 504, 'Printer connection timed out');
            });

            client.connect(printerPort, printerIp, () => {
                console.log(`[CONNECTED] Sending data to ${printerIp}:${printerPort}...`);
                client.write(payload, () => {
                    console.log(`[SUCCESS] Data sent successfully to ${printerIp}:${printerPort}`);
                    client.end(); // Send FIN packet

                    // Wait for the printer to acknowledge and close the connection
                    let closed = false;
                    client.once('close', () => {
                        closed = true;
                        finish(null, 200, 'Print job sent successfully');
                    });

                    // If printer doesn't close within 3 seconds, force destroy
                    setTimeout(() => {
                        if (!closed) {
                            console.log(`[FORCE CLOSE] Printer did not close in time`);
                            finish(null, 200, 'Print job sent successfully (forced)');
                        }
                    }, 3000);
                });
            });
        });
    }).catch(err => {
        console.error(`[QUEUE ERROR] for ${printerIp}:`, err);
    });
});

app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🖨️ Sinver Local Print Proxy `);
    console.log(`Listening on http://localhost:${PORT}`);
    console.log('=================================');
    console.log('Keep this window open while taking orders to enable TCP printing.');
});
