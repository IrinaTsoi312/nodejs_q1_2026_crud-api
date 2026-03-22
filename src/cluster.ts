import cluster from 'cluster';
import { availableParallelism } from 'os';
import http from 'http';
import { env } from './env';
import { Products, Product } from './productsDB/products.types';

// Shared products for cluster mode
export let multiClusterProducts: Products = [];

// Get number of workers
export function getNumWorkers(): number {
  return availableParallelism() - 1;
}

// Broadcast state to all workers
export function broadcastStateToWorkers() {
  if (cluster.isPrimary) {
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker && worker.isConnected()) {
        worker.send({
          type: 'STATE_UPDATE',
          products: [...multiClusterProducts], // Send a copy
        });
      }
    }
  }
}

// Create master load balancer
export function createLoadBalancer(): http.Server {
  let currentWorkerIndex = 0;
  const numWorkers = getNumWorkers();
  const basePort = parseInt(env.PORT);
  const workerPorts = Array.from({ length: numWorkers }, (_, i) => basePort + i + 1);

  const server = http.createServer((req, res) => {
    // Select next worker using round-robin
    const selectedPort = workerPorts[currentWorkerIndex % numWorkers];
    currentWorkerIndex++;

    // Forward the request to the worker
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: selectedPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      // Forward status code and headers
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);

      // Forward the response body
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Bad Gateway - Worker unavailable' }));
    });

    // Forward the request body
    req.pipe(proxyReq);
  });

  return server;
}

// Start cluster workers
export async function startClusterWorkers(
  startServerCallback: (port: number, isClusterWorker: boolean) => Promise<void>
) {
  if (cluster.isPrimary) {
    const numWorkers = getNumWorkers();
    const basePort = parseInt(env.PORT);

    console.log(`Master process (PID: ${process.pid})`);
    console.log(`Starting ${numWorkers} worker processes...`);
    console.log(`Load balancer listening on http://localhost:${basePort}`);
    console.log(`Workers listening on ports ${basePort + 1} to ${basePort + numWorkers}`);

    // Start load balancer on main port
    const loadBalancer = createLoadBalancer();
    loadBalancer.listen(basePort, '0.0.0.0', () => {
      console.log(`✓ Load balancer ready on port ${basePort}`);
    });

    // Create worker processes
    for (let i = 0; i < numWorkers; i++) {
      const worker = cluster.fork({ WORKER_INDEX: String(i) });
      console.log(`✓ Worker process ${i + 1} started (PID: ${worker.process.pid})`);

      // Handle messages from workers
      worker.on('message', (msg) => {
        if (msg.type === 'PRODUCT_OPERATION') {
          // Update master's product state
          if (msg.operation === 'POST') {
            multiClusterProducts.push(msg.products[0]);
          } else if (msg.operation === 'PUT') {
            const idx = multiClusterProducts.findIndex(p => p.id === msg.products[0].id);
            if (idx !== -1) {
              multiClusterProducts[idx] = msg.products[0];
            }
          } else if (msg.operation === 'DELETE') {
            const idx = multiClusterProducts.findIndex(p => p.id === msg.productId);
            if (idx !== -1) {
              multiClusterProducts.splice(idx, 1);
            }
          }

          // Broadcast updated state to all workers
          broadcastStateToWorkers();
        }
      });
    }

    // Handle worker crashes
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} exited. Restarting...`);
      const newWorker = cluster.fork({ WORKER_INDEX: String(worker.id - 1) });
      newWorker.on('message', (msg) => {
        if (msg.type === 'PRODUCT_OPERATION') {
          if (msg.operation === 'POST') {
            multiClusterProducts.push(msg.products[0]);
          } else if (msg.operation === 'PUT') {
            const idx = multiClusterProducts.findIndex(p => p.id === msg.products[0].id);
            if (idx !== -1) {
              multiClusterProducts[idx] = msg.products[0];
            }
          } else if (msg.operation === 'DELETE') {
            const idx = multiClusterProducts.findIndex(p => p.id === msg.productId);
            if (idx !== -1) {
              multiClusterProducts.splice(idx, 1);
            }
          }
          broadcastStateToWorkers();
        }
      });
    });
  } else {
    // Worker process - get worker index from environment variable
    const workerIndex = parseInt(process.env.WORKER_INDEX || '0', 10);
    const basePort = parseInt(env.PORT);
    const workerPort = basePort + workerIndex + 1;

    // Create a local products array for this worker
    const workerProducts: any[] = [];

    // Store in global so crud-routes can access it after server creation
    (global as any).workerProducts = workerProducts;

    // Start the server (it will use the workerProducts array)
    await startServerCallback(workerPort, true);

    // Handle state updates from master - update the local workerProducts array
    process.on('message', (msg: any) => {
      if (msg && msg.type === 'STATE_UPDATE') {
        // Clear the array and repopulate with new state
        workerProducts.length = 0;
        workerProducts.push(...msg.products);
      }
    });
  }
}
