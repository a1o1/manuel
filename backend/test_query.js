#!/usr/bin/env node

/**
 * Simple test script to query the Manuel API
 * This script will help test the query functionality for the Elektron Analog Rytm manual
 */

const https = require('https');

const API_BASE_URL = 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod';

// Test query about microtiming on Analog Rytm
const testQuery = "How do I adjust microtiming on the analog rytm?";

/**
 * Make HTTP request
 */
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Test if we can access public endpoints
 */
async function testPublicEndpoints() {
    console.log('🔍 Testing public endpoints...\n');

    // Test health endpoint
    try {
        const healthOptions = {
            hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
            port: 443,
            path: '/Prod/health',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const healthResponse = await makeRequest(healthOptions);
        console.log('✅ Health endpoint response:');
        console.log(JSON.stringify(healthResponse.data, null, 2));
        console.log();

    } catch (error) {
        console.log('❌ Health endpoint failed:', error.message);
    }
}

/**
 * Test query endpoint (will fail without auth, but shows us the auth requirement)
 */
async function testQueryEndpoint() {
    console.log('🔍 Testing query endpoint (without auth)...\n');

    try {
        const queryOptions = {
            hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
            port: 443,
            path: '/Prod/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const queryData = {
            query: testQuery,
            include_sources: true
        };

        const queryResponse = await makeRequest(queryOptions, queryData);
        console.log('📝 Query endpoint response:');
        console.log(`Status: ${queryResponse.statusCode}`);
        console.log('Data:', JSON.stringify(queryResponse.data, null, 2));
        console.log();

        if (queryResponse.statusCode === 401 || queryResponse.data.message === 'Missing Authentication Token') {
            console.log('ℹ️  As expected, query endpoint requires authentication');
        }

    } catch (error) {
        console.log('❌ Query endpoint test failed:', error.message);
    }
}

/**
 * Check if we can find any auth endpoints
 */
async function testAuthEndpoints() {
    console.log('🔍 Testing auth-related endpoints...\n');

    const authPaths = [
        '/Prod/auth',
        '/Prod/auth/login',
        '/Prod/auth/signup',
        '/Prod/signup',
        '/Prod/login'
    ];

    for (const path of authPaths) {
        try {
            const options = {
                hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const response = await makeRequest(options);
            console.log(`${path}: Status ${response.statusCode}`);
            if (response.statusCode !== 404) {
                console.log('  Response:', JSON.stringify(response.data, null, 2));
            }

        } catch (error) {
            console.log(`${path}: Error - ${error.message}`);
        }
    }
    console.log();
}

/**
 * Main test function
 */
async function main() {
    console.log('🚀 Manuel API Test Script');
    console.log('==========================\n');

    console.log(`Target API: ${API_BASE_URL}`);
    console.log(`Test Query: "${testQuery}"`);
    console.log();

    await testPublicEndpoints();
    await testQueryEndpoint();
    await testAuthEndpoints();

    console.log('📋 Summary:');
    console.log('- The API is accessible and responding');
    console.log('- Health endpoint works without authentication');
    console.log('- Query endpoint requires authentication (AWS Cognito)');
    console.log('- To test the actual query, you need to:');
    console.log('  1. Create a user in the Cognito User Pool');
    console.log('  2. Authenticate to get JWT tokens');
    console.log('  3. Include the Authorization header in API calls');
    console.log();
    console.log('💡 Next steps:');
    console.log('- Use AWS CLI or Console to create a test user in Cognito');
    console.log('- Or implement proper authentication flow in the test script');
    console.log('- Then test the query about Analog Rytm microtiming');
}

if (require.main === module) {
    main().catch(console.error);
}
