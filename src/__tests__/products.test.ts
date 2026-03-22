import Fastify, { FastifyInstance } from 'fastify';
import { productRoutes } from '../methods/crud-routes';

describe('Products API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    app.get('/', async () => {
      return { message: 'Welcome to CRUD API!' };
    });

    app.setNotFoundHandler((request, reply) => {
      reply.status(404).send({
        message: `Route ${request.method} ${request.url} not found`,
      });
    });

    await productRoutes(app);
  }, 15000);

  afterAll(async () => {
    await app.close();
  }, 15000);

  describe('Scenario 1: Complete CRUD Flow', () => {
    let productId: string;

    it('GET /api/products - should return empty array initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    }, 10000);

    it('POST /api/products - should create a new product', async () => {
      const newProduct = {
        name: 'Laptop',
        description: 'High-performance laptop',
        price: 999.99,
        cathegory: 'electronics',
        inStock: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: newProduct,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(201);
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(newProduct.name);
      expect(body.price).toBe(newProduct.price);
      
      productId = body.id;
    }, 10000);

    it('GET /api/products/{id} - should retrieve the created product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${productId}`,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.id).toBe(productId);
      expect(body.name).toBe('Laptop');
      expect(body.price).toBe(999.99);
    }, 10000);

    it('PUT /api/products/{id} - should update the product', async () => {
      const updates = {
        price: 899.99,
        inStock: false,
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/products/${productId}`,
        payload: updates,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.id).toBe(productId);
      expect(body.price).toBe(899.99);
      expect(body.inStock).toBe(false);
      expect(body.name).toBe('Laptop'); // unchanged fields
    }, 10000);

    it('DELETE /api/products/{id} - should delete the product', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/products/${productId}`,
      });

      expect(response.statusCode).toBe(204);
    }, 10000);

    it('GET /api/products/{id} - should return 404 after deletion', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${productId}`,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('Product not found');
    }, 10000);
  });

  describe('Scenario 2: Validation Errors', () => {
    it('POST /api/products - should return 400 for missing required fields', async () => {
      const invalidProduct = {
        name: 'Phone', // missing other required fields
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: invalidProduct,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toContain('Validation failed');
      expect(body.errors).toBeDefined();
    }, 10000);

    it('POST /api/products - should return 400 for negative price', async () => {
      const invalidProduct = {
        name: 'Phone',
        description: 'Mobile phone',
        price: -100,
        cathegory: 'electronics',
        inStock: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: invalidProduct,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toContain('Validation failed');
    }, 10000);

    it('GET /api/products/{id} - should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products/invalid-id',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('Invalid productId');
    }, 10000);

    it('PUT /api/products/{id} - should return 404 for non-existent product', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'PUT',
        url: `/api/products/${fakeId}`,
        payload: { price: 100 },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('Product not found');
    }, 10000);

    it('DELETE /api/products/{id} - should return 404 for non-existent product', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440001';
      
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/products/${fakeId}`,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('Product not found');
    }, 10000);
  });

  describe('Scenario 3: Bulk Operations', () => {
    let createdIds: string[] = [];

    it('POST /api/products - should create multiple products at once', async () => {
      const products = [
        {
          name: 'Mouse',
          description: 'Wireless mouse',
          price: 29.99,
          cathegory: 'accessories',
          inStock: true,
        },
        {
          name: 'Keyboard',
          description: 'Mechanical keyboard',
          price: 99.99,
          cathegory: 'accessories',
          inStock: true,
        },
        {
          name: 'Monitor',
          description: '27-inch monitor',
          price: 399.99,
          cathegory: 'electronics',
          inStock: false,
        },
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: products,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(201);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      expect(body[0].name).toBe('Mouse');
      expect(body[1].name).toBe('Keyboard');
      expect(body[2].name).toBe('Monitor');

      createdIds = body.map((p: any) => p.id);
    }, 10000);

    it('GET /api/products - should return all created products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.length).toBe(3);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Mouse' }),
          expect.objectContaining({ name: 'Keyboard' }),
          expect.objectContaining({ name: 'Monitor' }),
        ])
      );
    }, 10000);

    it('should allow filtering products by checking returned data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      
      const inStockProducts = body.filter((p: any) => p.inStock === true);
      expect(inStockProducts.length).toBe(2);
      
      const outOfStockProducts = body.filter((p: any) => p.inStock === false);
      expect(outOfStockProducts.length).toBe(1);
    }, 10000);

    it('POST /api/products - should handle mixed valid and invalid items', async () => {
      const mixedItems = [
        {
          name: 'Speaker',
          description: 'Bluetooth speaker',
          price: 49.99,
          cathegory: 'audio',
          inStock: true,
        },
        {
          name: 'Headphones', // missing required fields - invalid
        },
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: mixedItems,
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toContain('Validation failed');
      expect(body.errors).toBeDefined();
    }, 10000);
  });

  describe('Scenario 4: Edge Cases and Not Found', () => {
    it('GET /invalid-route - should return 404 for non-existent route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/invalid-route',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(404);
      expect(body.message).toContain('not found');
    }, 10000);

    it('POST /api/products with empty object should fail validation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {},
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toContain('Validation failed');
    }, 10000);

    it('PUT /api/products/{id} with invalid UUID format', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/products/not-a-uuid',
        payload: { price: 100 },
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('Invalid productId');
    }, 10000);

    it('DELETE /api/products/{id} with invalid UUID format', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/products/not-a-uuid',
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('Invalid productId');
    }, 10000);
  });
});
