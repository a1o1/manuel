# Manuel Test CLI

A simplified command-line interface for testing Manuel's voice assistant functionality. This CLI provides the same core features as the full frontend CLI but with a simpler, more reliable interface.

## Features

- ✅ **Authentication**: Automatic login with test credentials
- ✅ **Query Processing**: Text-based questions with AI-powered responses
- ✅ **Manual Management**: List uploaded manuals
- ✅ **Interactive Mode**: Menu-driven interface
- ✅ **Knowledge Base Integration**: RAG queries using Bedrock Knowledge Base
- ✅ **User Isolation**: Proper separation of user data
- ✅ **Source Attribution**: Shows which manual sections were used for answers

## Prerequisites

```bash
# Install AWS SDK
npm install aws-sdk
```

## Usage

### Command Line Mode

```bash
# Ask a question
node test_cli.js query "How do I adjust microtiming on the analog rytm?"

# List uploaded manuals
node test_cli.js manuals

# Show help
node test_cli.js --help
```

### Interactive Mode

```bash
# Start interactive mode
node test_cli.js

# Available commands in interactive mode:
manuel> help
manuel> manuals
manuel> query How do I change samples?
manuel> exit
```

## Example Session

```bash
$ node test_cli.js query "How do I adjust microtiming on the analog rytm?"

═══════════════════════════════════════
   MANUEL CLI - Voice Assistant for Manuals
═══════════════════════════════════════

🔐 Authenticating...
✅ Authentication successful!
🔍 Asking: "How do I adjust microtiming on the analog rytm?"

🤖 Answer:
──────────────────────────────────────────────────

Based on the manual, here's how to adjust microtiming on the Analog Rytm:

**To add microtiming to a note trig:**

1. **Press and hold the [TRIG] key** for the note you want to adjust
2. **While holding [TRIG], press the [ARROW] keys [LEFT] or [RIGHT]**
   - [LEFT] shifts the timing backward on the time grid
   - [RIGHT] shifts the timing forward on the time grid
3. **A micro timing pop-up menu will appear** showing the time offset

**Visual feedback:**
- When you press a [TRIG] key that already contains a micro timed trig, the [LEFT] or [RIGHT] arrow key will light up to indicate the direction of the micro timing that's currently applied.

📚 Sources:
  1. f126f052-10f1-42d1-b810-e4d63db7d79f.pdf
  2. f126f052-10f1-42d1-b810-e4d63db7d79f.pdf
  3. f126f052-10f1-42d1-b810-e4d63db7d79f.pdf

🔍 Context found: true
```

## Configuration

The CLI uses hardcoded test credentials:
- **Email**: test@example.com
- **Password**: TestPassword123!
- **API Endpoint**: https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod

These are automatically configured and don't require manual setup.

## Architecture

- **Authentication**: AWS Cognito with admin authentication flow
- **API Communication**: Direct HTTPS requests to API Gateway
- **Knowledge Base**: Bedrock Knowledge Base with Claude Sonnet 4
- **User Isolation**: All queries are scoped to the authenticated user
- **Colored Output**: ANSI color codes for better readability

## Error Handling

The CLI provides detailed error messages and handles:
- Network connectivity issues
- Authentication failures
- API errors
- Invalid input
- Missing manuals

## Comparison with Full CLI

| Feature | Test CLI | Full CLI |
|---------|----------|----------|
| Query functionality | ✅ | ✅ |
| Manual management | ✅ List only | ✅ Full CRUD |
| Authentication | ✅ Hardcoded | ✅ Interactive |
| Voice recording | ❌ | ✅ |
| Configuration | ❌ | ✅ |
| Complex UI | ❌ | ✅ |
| Reliability | ✅ Very stable | ⚠️ Some UI issues |

## Use Cases

- **Development Testing**: Quick testing of backend functionality
- **CI/CD Integration**: Automated testing in pipelines
- **Debugging**: Simple interface for troubleshooting
- **Demo Purposes**: Reliable demo without UI complications
- **Integration Testing**: Testing API endpoints and authentication

## Files

- `test_cli.js`: Main CLI implementation
- `authenticate.js`: Authentication helper functions
- `test_query_simple.js`: Simple query testing script

## Troubleshooting

**AWS SDK warnings**: The v2 SDK shows deprecation warnings but still works correctly.

**Authentication errors**: Ensure the test user exists in Cognito with the correct password.

**Network errors**: Check that the API Gateway endpoint is accessible.

**No context found**: Ensure manuals have been uploaded and ingested into the Knowledge Base.