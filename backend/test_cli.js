#!/usr/bin/env node

/**
 * Minimal CLI for testing Manuel query functionality
 * This bypasses the full CLI build issues to test core functionality
 */

const AWS = require('aws-sdk');
const https = require('https');
const readline = require('readline');

const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'eu-west-1' });
const USER_POOL_ID = 'eu-west-1_DQt2MDcmp';
const CLIENT_ID = '3ai5dri6105vaut9bie6ku5omb';
const API_BASE_URL = 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod';

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function authenticateUser(username, password) {
    const params = {
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    try {
        const result = await cognito.adminInitiateAuth(params).promise();
        log('✅ Authentication successful!', 'green');
        return result.AuthenticationResult;
    } catch (error) {
        log(`❌ Authentication failed: ${error.message}`, 'red');
        return null;
    }
}

async function query(idToken, question) {
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

async function listManuals(idToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '83bcch9z1c.execute-api.eu-west-1.amazonaws.com',
            port: 443,
            path: '/Prod/api/manuals',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
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

        req.end();
    });
}

function displayBanner() {
    log('\n═══════════════════════════════════════', 'cyan');
    log('   MANUEL CLI - Voice Assistant for Manuals', 'cyan');
    log('═══════════════════════════════════════\n', 'cyan');
}

function displayHelp() {
    log('Available commands:', 'yellow');
    log('  query <question>  - Ask a question about your manuals', 'white');
    log('  manuals           - List your uploaded manuals', 'white');
    log('  help              - Show this help message', 'white');
    log('  exit              - Exit the CLI', 'white');
    log('');
}

async function runInteractiveMode(tokens) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'manuel> '
    });

    log('🎉 Welcome to Manuel CLI! Type "help" for commands or "exit" to quit.', 'green');
    log('');

    rl.prompt();

    rl.on('line', async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
            rl.prompt();
            return;
        }

        const parts = trimmed.split(' ');
        const command = parts[0].toLowerCase();

        try {
            if (command === 'exit' || command === 'quit') {
                log('👋 Goodbye!', 'yellow');
                rl.close();
                return;
            }

            if (command === 'help') {
                displayHelp();
                rl.prompt();
                return;
            }

            if (command === 'manuals') {
                log('📚 Fetching your manuals...', 'cyan');
                const result = await listManuals(tokens.IdToken);

                if (result.statusCode === 200 && result.data.manuals) {
                    if (result.data.manuals.length === 0) {
                        log('📄 No manuals found. Upload some manuals first!', 'yellow');
                    } else {
                        log(`📋 Found ${result.data.manuals.length} manual(s):`, 'green');
                        result.data.manuals.forEach((manual, i) => {
                            log(`  ${i + 1}. ${manual.name} (${manual.size} bytes)`, 'white');
                            log(`     Uploaded: ${manual.upload_date}`, 'white');
                        });
                    }
                } else {
                    log(`❌ Error fetching manuals: ${JSON.stringify(result.data)}`, 'red');
                }
                rl.prompt();
                return;
            }

            if (command === 'query') {
                const question = parts.slice(1).join(' ');
                if (!question) {
                    log('❌ Please provide a question. Example: query How do I reset my device?', 'red');
                    rl.prompt();
                    return;
                }

                log(`🔍 Searching for: "${question}"`, 'cyan');
                log('⏳ Processing with AI...', 'yellow');

                const result = await query(tokens.IdToken, question);

                if (result.statusCode === 200 && result.data.answer) {
                    log('\n🤖 Answer:', 'green');
                    log('─'.repeat(50), 'white');
                    log(result.data.answer, 'white');

                    if (result.data.sources && result.data.sources.length > 0) {
                        log('\n📚 Sources:', 'blue');
                        result.data.sources.forEach((source, i) => {
                            const filename = source.split('/').pop();
                            log(`  ${i + 1}. ${filename}`, 'white');
                        });
                    }

                    log(`\n🔍 Context found: ${result.data.context_found ? 'Yes' : 'No'}`, 'yellow');
                    log('');
                } else {
                    log(`❌ Query failed: ${JSON.stringify(result.data)}`, 'red');
                }
                rl.prompt();
                return;
            }

            log(`❌ Unknown command: ${command}. Type "help" for available commands.`, 'red');

        } catch (error) {
            log(`❌ Error: ${error.message}`, 'red');
        }

        rl.prompt();
    });

    rl.on('close', () => {
        log('\n👋 Goodbye!', 'yellow');
        process.exit(0);
    });
}

async function main() {
    displayBanner();

    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        log('Usage:', 'yellow');
        log('  node test_cli.js                 - Start interactive mode', 'white');
        log('  node test_cli.js query <question> - Ask a single question', 'white');
        log('  node test_cli.js manuals          - List manuals', 'white');
        log('');
        if (args.length === 0) {
            // Start interactive mode
            log('🔐 Authenticating with stored credentials...', 'cyan');
            const tokens = await authenticateUser('test@example.com', 'TestPassword123!');

            if (tokens) {
                await runInteractiveMode(tokens);
            } else {
                log('❌ Authentication failed. Check your credentials.', 'red');
            }
        }
        return;
    }

    // Non-interactive mode
    log('🔐 Authenticating...', 'cyan');
    const tokens = await authenticateUser('test@example.com', 'TestPassword123!');

    if (!tokens) {
        log('❌ Authentication failed. Check your credentials.', 'red');
        process.exit(1);
    }

    const command = args[0];

    if (command === 'query') {
        const question = args.slice(1).join(' ');
        if (!question) {
            log('❌ Please provide a question.', 'red');
            process.exit(1);
        }

        log(`🔍 Asking: "${question}"`, 'cyan');
        const result = await query(tokens.IdToken, question);

        if (result.statusCode === 200 && result.data.answer) {
            log('\n🤖 Answer:', 'green');
            log('─'.repeat(50), 'white');
            console.log(result.data.answer);

            if (result.data.sources && result.data.sources.length > 0) {
                log('\n📚 Sources:', 'blue');
                result.data.sources.forEach((source, i) => {
                    const filename = source.split('/').pop();
                    log(`  ${i + 1}. ${filename}`, 'white');
                });
            }
        } else {
            log(`❌ Query failed: ${JSON.stringify(result.data)}`, 'red');
            process.exit(1);
        }
    } else if (command === 'manuals') {
        log('📚 Fetching your manuals...', 'cyan');
        const result = await listManuals(tokens.IdToken);

        if (result.statusCode === 200 && result.data.manuals) {
            if (result.data.manuals.length === 0) {
                log('📄 No manuals found.', 'yellow');
            } else {
                log(`📋 Found ${result.data.manuals.length} manual(s):`, 'green');
                result.data.manuals.forEach((manual, i) => {
                    log(`  ${i + 1}. ${manual.name} (${manual.size} bytes)`, 'white');
                });
            }
        } else {
            log(`❌ Error: ${JSON.stringify(result.data)}`, 'red');
            process.exit(1);
        }
    } else {
        log(`❌ Unknown command: ${command}`, 'red');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        log(`💥 Fatal error: ${error.message}`, 'red');
        process.exit(1);
    });
}
