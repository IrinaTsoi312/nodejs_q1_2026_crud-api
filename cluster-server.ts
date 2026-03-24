import Fastify from 'fastify';
import cluster from 'cluster';
import { startClusterWorkers, multiClusterProducts, broadcastStateToWorkers } from './src/cluster';
import { productRoutes } from './src/methods/crud-routes';
import { env } from './src/env';

async function createAndStartServer(port: number, isClusterWorker: boolean): Promise<void> {
  const app = Fastify({
    logger: !isClusterWorker, // Reduce logging noise for workers
  });

  app.get('/', async () => {
    return { message: 'Welcome to CRUD API!' };
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // Determine which products array to use
  let productsArray;
  if (isClusterWorker && (global as any).workerProducts) {
    // Use the worker's local products array that will be synced via IPC
    productsArray = (global as any).workerProducts;
  } else {
    // Use the shared multiClusterProducts in primary (for non-cluster mode)
    productsArray = multiClusterProducts;
  }

  await productRoutes(app, productsArray);

  await app.listen({
    port,
    host: '0.0.0.0',
  });

  if (isClusterWorker) {
    console.log(
      `Worker ${process.pid} listening on http://localhost:${port}`
    );

    // Send initial state request to master
    if (process.send) {
      process.send({ type: 'READY' });
    }
  } else {
    console.log(
      `✓ Server ready on http://localhost:${port} (${env.NODE_ENV} mode)`
    );
  }
}

// Start cluster or regular server
startClusterWorkers(createAndStartServer);

