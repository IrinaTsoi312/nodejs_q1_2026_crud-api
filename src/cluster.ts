import cluster from 'cluster';
import { availableParallelism } from 'os';
import http from 'http';
import { env } from './env';
import { Products } from './productsDB/products.types';

export let multiClusterProducts: Products = [];

export function getNumWorkers(): number {
  return availableParallelism() - 1;
}

export function broadcastStateToWorkers() {
  if (cluster.isPrimary) {
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker && worker.isConnected()) {
        worker.send({
          type: 'STATE_UPDATE',
          products: [...multiClusterProducts],
        });
      }
    }
  }
}

export function createLoadBalancer(): http.Server {
  let currentWorkerIndex = 0;
  const numWorkers = getNumWorkers();
  const basePort = parseInt(env.PORT);
  const workerPorts = Array.from({ length: numWorkers }, (_, i) => basePort + i + 1);

  const server = http.createServer((req, res) => {
    const selectedPort = workerPorts[currentWorkerIndex % numWorkers];
    currentWorkerIndex++;

    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: selectedPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Bad Gateway - Worker unavailable' }));
    });

    req.pipe(proxyReq);
  });

  return server;
}

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

    const loadBalancer = createLoadBalancer();
    loadBalancer.listen(basePort, '0.0.0.0', () => {
      console.log(`✓ Load balancer ready on port ${basePort}`);
    });

    for (let i = 0; i < numWorkers; i++) {
      const worker = cluster.fork({ WORKER_INDEX: String(i) });
      console.log(`✓ Worker process ${i + 1} started (PID: ${worker.process.pid})`);

      worker.on('message', (msg) => {
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
    }

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
    const workerIndex = parseInt(process.env.WORKER_INDEX || '0', 10);
    const basePort = parseInt(env.PORT);
    const workerPort = basePort + workerIndex + 1;

    const workerProducts: any[] = [];

    (global as any).workerProducts = workerProducts;

    await startServerCallback(workerPort, true);

    process.on('message', (msg: any) => {
      if (msg && msg.type === 'STATE_UPDATE') {
        workerProducts.length = 0;
        workerProducts.push(...msg.products);
      }
    });
  }
}
