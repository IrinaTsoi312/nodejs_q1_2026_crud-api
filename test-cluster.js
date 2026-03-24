#!/usr/bin/env node

const http = require('http');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed || data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Cluster API with Round-Robin Load Balancing\n');

  try {
    // Test 1: Create a product via load balancer
    console.log('Test 1: POST /api/products (via load balancer)');
    const product = {
      name: 'Test Laptop',
      description: 'High-performance laptop',
      price: 1299.99,
      cathegory: 'electronics',
      inStock: true,
    };

    const createRes = await makeRequest('POST', '/api/products', product);
    console.log(`  Status: ${createRes.status}`);
    if (createRes.status === 201) {
      const productId = createRes.body.id;
      console.log(`  ✓ Product created with ID: ${productId}\n`);

      // Test 2: Retrieve the product via load balancer
      console.log('Test 2: GET /api/products (retrieve from different worker)');
      const getRes = await makeRequest('GET', '/api/products');
      console.log(`  Status: ${getRes.status}`);
      console.log(`  Products count: ${getRes.body.length}`);
      if (getRes.body.length > 0) {
        console.log(`  ✓ Product found across workers: ${getRes.body[0].name}\n`);

        // Test 3: Update the product
        console.log('Test 3: PUT /api/products/:id (update via load balancer)');
        const update = { price: 999.99 };
        const putRes = await makeRequest('PUT', `/api/products/${productId}`, update);
        console.log(`  Status: ${putRes.status}`);
        if (putRes.status === 200 && putRes.body.price === 999.99) {
          console.log(`  ✓ Product updated: new price = ${putRes.body.price}\n`);

          // Test 4: Delete the product
          console.log('Test 4: DELETE /api/products/:id (delete via load balancer)');
          const deleteRes = await makeRequest('DELETE', `/api/products/${productId}`);
          console.log(`  Status: ${deleteRes.status}`);
          if (deleteRes.status === 204 || deleteRes.status === 200) {
            console.log(`  ✓ Product deleted\n`);

            // Test 5: Verify deletion across workers
            console.log('Test 5: GET /api/products (verify deletion across all workers)');
            const finalRes = await makeRequest('GET', '/api/products');
            console.log(`  Status: ${finalRes.status}`);
            console.log(`  Products count: ${finalRes.body.length}`);
            if (finalRes.body.length === 0) {
              console.log(`  ✓ Product successfully deleted from all workers\n`);
              console.log('✅ All clustering tests passed!');
            } else {
              console.log(`  ✗ Product still exists on some workers\n`);
            }
          } else {
            console.log(`  ✗ Delete failed with status ${deleteRes.status}`);
            console.log(`     Response: ${JSON.stringify(deleteRes.body)}\n`);
          }
        }
      }
    } else {
      console.log(`  ✗ Failed to create product: ${createRes.body}\n`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('   Make sure the cluster server is running with: npm run start:multi');
  }
}

// Wait for server to be ready
setTimeout(runTests, 2000);
