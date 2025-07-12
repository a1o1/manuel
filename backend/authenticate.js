#!/usr/bin/env node

/**
 * Simple authentication script for Manuel API testing
 * This script helps you authenticate with AWS Cognito and get JWT tokens
 */

const https = require('https');
const crypto = require('crypto');

// Values from our CloudFormation deployment
const USER_POOL_ID = 'eu-west-1_DQt2MDcmp';
const CLIENT_ID = '3ai5dri6105vaut9bie6ku5omb';
const REGION = 'eu-west-1';

const API_BASE_URL = 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod';

/**
 * Create SRP (Secure Remote Password) authentication challenge
 * This is a simplified version - in production you'd use the AWS SDK
 */
function createSRPChallenge(username, password) {
    // For testing purposes, we'll try the simpler USER_PASSWORD_AUTH flow
    // Note: This might not work if the User Pool is configured for SRP only
    return {
        USERNAME: username,
        PASSWORD: password
    };
}

/**
 * Authenticate with Cognito using AWS SDK approach
 * This requires the AWS SDK to be installed
 */
async function authenticateWithAWS(username, password) {
    try {
        const AWS = require('aws-sdk');

        const cognito = new AWS.CognitoIdentityServiceProvider({
            region: REGION
        });

        // Try USER_PASSWORD_AUTH first (simpler)
        let params = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password
            }
        };

        try {
            const result = await cognito.initiateAuth(params).promise();

            if (result.AuthenticationResult) {
                console.log('✅ Authentication successful!');
                console.log('Access Token:', result.AuthenticationResult.AccessToken);
                console.log('ID Token:', result.AuthenticationResult.IdToken);
                console.log('Refresh Token:', result.AuthenticationResult.RefreshToken);
                return result.AuthenticationResult;
            }

        } catch (error) {
            if (error.code === 'NotAuthorizedException' && error.message.includes('USER_PASSWORD_AUTH')) {
                console.log('ℹ️  USER_PASSWORD_AUTH not allowed, trying USER_SRP_AUTH...');

                // Fall back to SRP authentication
                params.AuthFlow = 'USER_SRP_AUTH';
                delete params.AuthParameters.PASSWORD;

                const srpResult = await cognito.initiateAuth(params).promise();
                console.log('⚠️  SRP challenge received. This requires additional implementation.');
                console.log('Challenge:', srpResult.ChallengeName);
                return null;
            }
            throw error;
        }

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);

        if (error.code === 'UserNotFoundException') {
            console.log('💡 The user does not exist. Please create the user first.');
        } else if (error.code === 'NotAuthorizedException') {
            console.log('💡 Invalid credentials or user not confirmed.');
        } else if (error.message.includes('aws-sdk')) {
            console.log('💡 AWS SDK not installed. Install with: npm install aws-sdk');
        }

        return null;
    }
}

/**
 * Test query with authentication token
 */
async function testQuery(accessToken, query) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            question: query
        });

        const options = {
            hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
            port: 443,
            path: '/Prod/api/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
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

/**
 * Get User Pool and Client ID from CloudFormation
 */
async function getStackOutputs() {
    try {
        const AWS = require('aws-sdk');
        const cloudformation = new AWS.CloudFormation({ region: REGION });

        // Try common stack names
        const possibleStackNames = [
            'manuel-dev-minimal',
            'manuel-dev',
            'manuel-prod',
            'manuel-staging',
            'manuel'
        ];

        for (const stackName of possibleStackNames) {
            try {
                const result = await cloudformation.describeStacks({ StackName: stackName }).promise();
                const outputs = result.Stacks[0].Outputs;

                console.log(`\n📋 Found stack: ${stackName}`);
                console.log('Outputs:');
                outputs.forEach(output => {
                    console.log(`  ${output.OutputKey}: ${output.OutputValue}`);
                });

                const userPoolId = outputs.find(o => o.OutputKey === 'UserPoolId')?.OutputValue;
                const clientId = outputs.find(o => o.OutputKey === 'UserPoolClientId')?.OutputValue;

                if (userPoolId && clientId) {
                    return { userPoolId, clientId };
                }

            } catch (error) {
                // Stack doesn't exist, continue
            }
        }

        console.log('❌ No Manuel stacks found or no AWS access');
        return null;

    } catch (error) {
        console.log('❌ Error accessing CloudFormation:', error.message);
        return null;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Manuel Authentication Helper');
    console.log('================================\n');

    // Check if we can get stack outputs
    console.log('🔍 Looking for CloudFormation stack outputs...');
    const stackInfo = await getStackOutputs();

    if (stackInfo) {
        console.log(`\n✅ Found User Pool ID: ${stackInfo.userPoolId}`);
        console.log(`✅ Found Client ID: ${stackInfo.clientId}`);

        // Update the constants
        const userPoolId = stackInfo.userPoolId;
        const clientId = stackInfo.clientId;

        // Test authentication
        console.log('\n🔐 Testing authentication...');
        const tokens = await authenticateWithAWS('test@example.com', 'TestPassword123!');

        if (tokens) {
            console.log('\n🧪 Testing query with authentication...');
            const queryResult = await testQuery(tokens.AccessToken, 'How do I adjust microtiming on the analog rytm?');

            console.log(`\n📝 Query Result (Status: ${queryResult.statusCode}):`);
            console.log(JSON.stringify(queryResult.data, null, 2));
        }

    } else {
        console.log('\n📋 Manual Setup Required:');
        console.log('1. Get your User Pool ID and Client ID from CloudFormation outputs:');
        console.log('   aws cloudformation describe-stacks --stack-name YOUR_STACK_NAME --region eu-west-1');
        console.log('\n2. Update the constants in this script:');
        console.log(`   USER_POOL_ID = 'your_user_pool_id'`);
        console.log(`   CLIENT_ID = 'your_client_id'`);
        console.log('\n3. Create a test user:');
        console.log('   aws cognito-idp admin-create-user --user-pool-id YOUR_POOL_ID --username test@example.com');
        console.log('\n4. Set user password:');
        console.log('   aws cognito-idp admin-set-user-password --user-pool-id YOUR_POOL_ID --username test@example.com --password TestPassword123! --permanent');
        console.log('\n5. Install AWS SDK:');
        console.log('   npm install aws-sdk');
        console.log('\n6. Run this script again');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    authenticateWithAWS,
    testQuery
};
