# Manuel CLI

Command-line interface for querying product manuals using voice and text.

## Features

- **Full Authentication**: Login, signup, password reset
- **Interactive Mode**: Rich terminal interface for all operations
- **Voice Queries**: Record audio directly in terminal
- **Text Queries**: Fast text-based queries with formatting
- **Manual Management**: Upload, download, list, and delete manuals
- **Usage Analytics**: Detailed usage statistics and export capabilities
- **Configuration**: Persistent settings and preferences
- **Cross-Platform**: Works on macOS, Linux, and Windows

## Installation

### From Source (Development)

```bash
# Install dependencies
cd packages/cli-app
npm install

# Build the application
npm run build

# Link globally for development
npm link

# Now you can use 'manuel' command anywhere
manuel --help
```

### Global Installation (Future)

```bash
# Once published to npm
npm install -g @manuel/cli
```

## Quick Start

```bash
# Sign in to your account
manuel auth login

# Ask a question
manuel query "How do I reset my WiFi router?"

# Start interactive mode
manuel

# Get help
manuel --help
```

## Command Reference

### Authentication

```bash
manuel auth login                     # Sign in with email/password
manuel auth signup                    # Create new account
manuel auth logout                    # Sign out
manuel auth status                    # Check authentication status
manuel auth reset-password            # Reset password via email
```

### Queries

```bash
# Text queries
manuel query "How do I configure this?"
manuel query "Setup instructions" --sources
manuel q "Quick question"             # Short alias

# Voice queries
manuel query --voice                  # Record voice query
manuel query -v                       # Short flag

# Interactive query mode
manuel query --interactive            # Chat-style interface
manuel query -i                       # Short flag
```

### Manual Management

```bash
# List manuals
manuel manuals list                   # List all manuals
manuel manuals ls                     # Short alias

# Upload manual
manuel manuals upload <file>          # Upload PDF file
manuel manuals upload manual.pdf --name "Router Manual"

# Download from URL
manuel manuals download <url>         # Download PDF from URL
manuel manuals download https://example.com/manual.pdf --name "Manual"

# Delete manual
manuel manuals delete <manual-id>     # Delete by ID
manuel manuals rm <manual-id>         # Short alias
manuel manuals delete <manual-id> --force  # Skip confirmation

# Interactive management
manuel manuals interactive            # Interactive menu
manuel manuals                        # Same as interactive
```

### Usage Analytics

```bash
# Overview
manuel usage overview                 # General usage statistics
manuel usage stats                    # Alias for overview

# Today's usage
manuel usage today                    # Today's specific usage

# Quota information
manuel usage quotas                   # Show quota limits and remaining

# Cost analysis
manuel usage costs                    # Daily cost breakdown
manuel usage costs --period weekly    # Weekly costs
manuel usage costs --period monthly   # Monthly costs
manuel usage costs --json             # JSON output

# Usage history
manuel usage history                  # Last 7 days
manuel usage history --days 30        # Last 30 days
manuel usage history --json           # JSON output

# Export data
manuel usage export                   # Export to CSV (30 days)
manuel usage export --days 90         # Export 90 days
manuel usage export --format json     # Export as JSON
manuel usage export --output data.csv # Specific output file
```

### Configuration

```bash
# View configuration
manuel config show                    # Show current config
manuel config show --json             # JSON format

# Set values
manuel config set apiUrl https://api.manuel.ai
manuel config set defaultIncludeSources true
manuel config set defaultVoiceDuration 30
manuel config set verboseOutput false
manuel config set colorOutput true

# Get specific value
manuel config get apiUrl
manuel config get verboseOutput

# Interactive setup
manuel config interactive             # Guided configuration

# Reset to defaults
manuel config reset                   # Reset all settings
manuel config reset --force           # Skip confirmation
```

### Global Options

```bash
manuel --version                      # Show version
manuel --help                         # Show help
manuel --verbose                      # Verbose output
manuel --no-color                     # Disable colored output
manuel --config <file>                # Use specific config file
```

## Interactive Mode

Start interactive mode with just `manuel`:

```bash
$ manuel
```

This launches a rich terminal interface with:

- **Menu-driven navigation**: Easy access to all features
- **Authentication flow**: Guided login/signup process
- **Voice recording**: Terminal-based voice query interface
- **Manual management**: Upload, list, delete with confirmations
- **Real-time feedback**: Progress indicators and success/error messages
- **Contextual help**: Tips and guidance throughout

### Interactive Features

- **Smart input validation**: Real-time validation with helpful error messages
- **Progress indicators**: Visual feedback for long-running operations
- **Confirmation prompts**: Safe handling of destructive operations
- **Error recovery**: Graceful error handling with retry options
- **Keyboard shortcuts**: Efficient navigation and input

## Voice Queries

The CLI supports voice queries using system audio recording:

### Prerequisites

**macOS**: sox (audio recording)

```bash
brew install sox
```

**Linux**: sox and ALSA/PulseAudio

```bash
# Ubuntu/Debian
sudo apt-get install sox alsa-utils

# CentOS/RHEL
sudo yum install sox alsa-utils
```

**Windows**: sox for Windows

- Download from http://sox.sourceforge.net/
- Add to PATH

### Voice Recording

```bash
# Record voice query
manuel query --voice

# Interactive voice mode
manuel query --interactive --voice
```

During recording:

- **Visual feedback**: Recording indicator and timer
- **Quality control**: Automatic audio format optimization
- **Error handling**: Graceful fallback for audio issues

## Configuration

### Config File Locations

The CLI stores configuration in platform-specific locations:

- **macOS**: `~/Library/Application Support/manuel-cli/config.json`
- **Linux**: `~/.config/manuel-cli/config.json`
- **Windows**: `%APPDATA%/manuel-cli/config.json`

### Configuration Options

```json
{
  "apiUrl": "https://api.manuel.ai",
  "defaultIncludeSources": true,
  "defaultVoiceDuration": 30,
  "verboseOutput": false,
  "colorOutput": true
}
```

### Environment Variables

Override config with environment variables:

```bash
export MANUEL_API_URL="https://api.manuel.ai"
export MANUEL_VERBOSE=true
export MANUEL_NO_COLOR=true
```

## Output Formats

Most commands support multiple output formats:

### Human-Readable (Default)

Formatted, colored output optimized for terminal reading.

### JSON Output

Machine-readable JSON for scripting:

```bash
manuel usage stats --json | jq '.dailyQueries'
manuel manuals list --json | jq '.[].name'
```

### CSV Export

For usage data analysis:

```bash
manuel usage export --format csv --output usage.csv
```

## Error Handling

The CLI provides detailed error information:

- **Network errors**: Connection and timeout issues
- **Authentication errors**: Login and permission problems
- **Validation errors**: Input format and constraint violations
- **API errors**: Backend service issues
- **System errors**: File access and audio recording problems

### Exit Codes

- `0`: Success
- `1`: General error
- `2`: Authentication required
- `3`: Network error
- `4`: Validation error
- `5`: System error

## Scripting and Automation

The CLI is designed for scripting:

```bash
#!/bin/bash

# Check if authenticated
if ! manuel auth status --quiet; then
    echo "Please log in first"
    manuel auth login
fi

# Process multiple queries
for query in "How to setup?" "Configuration steps" "Troubleshooting"; do
    echo "Processing: $query"
    manuel query "$query" --json > "result_$(echo $query | tr ' ' '_').json"
done

# Export usage data
manuel usage export --format csv --output monthly_usage.csv
```

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Link for development
npm link

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
src/
├── commands/         # Command implementations
├── utils/           # Utility functions
├── bin/             # CLI entry point
└── types/           # TypeScript definitions
```

### Adding New Commands

1. Create command file in `src/commands/`
2. Implement command class with static `register()` method
3. Add to main CLI program in `src/bin/manuel.ts`
4. Update help text and documentation

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Troubleshooting

### Common Issues

**Command not found: manuel**

```bash
# Ensure globally linked
npm link

# Or add to PATH
export PATH="$PATH:$(npm bin -g)"
```

**Audio recording fails**

```bash
# Check sox installation
sox --version

# Test microphone
sox -t coreaudio default recording.wav trim 0 5
```

**Authentication issues**

```bash
# Clear stored credentials
manuel auth logout
manuel auth login

# Check API connectivity
curl https://api.manuel.ai/health
```

**Permission errors**

```bash
# Check file permissions
ls -la ~/.config/manuel-cli/

# Reset permissions
chmod 600 ~/.config/manuel-cli/config.json
```

### Debug Mode

Enable verbose output for debugging:

```bash
manuel --verbose query "test"
MANUEL_VERBOSE=true manuel auth login
```

### Log Files

Logs are written to:

- **macOS**: `~/Library/Logs/manuel-cli/`
- **Linux**: `~/.local/share/manuel-cli/logs/`
- **Windows**: `%LOCALAPPDATA%/manuel-cli/logs/`

## Performance Tips

1. **Use aliases**: Set up shell aliases for common commands
2. **Batch operations**: Use interactive mode for multiple actions
3. **JSON output**: Use `--json` for faster parsing in scripts
4. **Configuration**: Set defaults to avoid repeated flags

## Contributing

1. Follow Node.js and CLI best practices
2. Use TypeScript for all code
3. Add tests for new functionality
4. Update help text and documentation
5. Test on multiple platforms
6. Follow semantic versioning

## License

Same as main Manuel project.
