#!/usr/bin/env node

const AWS = require('aws-sdk');
const https = require('https');

const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'eu-west-1' });
const USER_POOL_ID = 'eu-west-1_DQt2MDcmp';
const CLIENT_ID = '3ai5dri6105vaut9bie6ku5omb';

async function authenticateUser() {
    const params = {
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
            USERNAME: 'test@example.com',
            PASSWORD: 'TestPassword123!'
        }
    };

    try {
        const result = await cognito.adminInitiateAuth(params).promise();
        console.log('✅ Authentication successful!');
        return result.AuthenticationResult;
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        return null;
    }
}

async function testQuery(idToken, question) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ question });

        const options = {
            hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
            port: 443,
            path: '/Prod/api/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
                'Content-Length': Buffer.byteLength(data)
            }
        };

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
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData
                    });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 Testing Manuel Query API');
    console.log('============================\n');
    
    // Authenticate
    console.log('🔐 Authenticating...');
    const tokens = await authenticateUser();
    
    if (!tokens) {
        console.log('❌ Authentication failed');
        return;
    }
    
    console.log('✅ Got ID Token\n');
    
    // Test query
    const question = 'How do I adjust microtiming on the analog rytm?';
    console.log(`🔍 Asking: "${question}"\n`);
    
    console.log('⏳ Querying Knowledge Base...');
    const result = await testQuery(tokens.IdToken, question);
    
    console.log(`\n📝 Response (Status: ${result.statusCode}):`);
    console.log('=' .repeat(50));
    
    if (result.statusCode === 200 && result.data.answer) {
        console.log('\n✅ SUCCESS!\n');
        console.log('🤖 Answer:');
        console.log(result.data.answer);
        
        if (result.data.sources && result.data.sources.length > 0) {
            console.log('\n📚 Sources:');
            result.data.sources.forEach((source, i) => {
                console.log(`  ${i + 1}. ${source}`);
            });
        }
        
        if (result.data.context_found !== undefined) {
            console.log(`\n🔍 Context found: ${result.data.context_found}`);
        }
        
    } else {
        console.log('\n❌ Error or unexpected response:');
        console.log(JSON.stringify(result.data, null, 2));
    }
}

main().catch(console.error);