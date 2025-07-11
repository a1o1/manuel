# Manuel Project - Context & Background

## Project Genesis
This project was initiated to create an intelligent voice assistant application specifically for querying product manuals. The core insight was to leverage AWS services to build a RAG (Retrieval Augmented Generation) system that could provide contextual, detailed answers from technical documentation.

## Key User Input & Decisions

### Initial Requirements (User Input)
> "This should be an application that allows the user to ask a question on the iphone frontend that is captured as audio when holding down a button. When the button is released the question is extracted and fed into an LLM that is augmented (via RAG) to pull the detailed information from a set of product manuals. It is this set of product manuals that is the key knowledge aspect and specialisation of this application."

### Architecture Preferences (User Input)
> "The backend should be solely focused on leveraging AWS services. Where decisions are to be made about alternative services, please ask. The core LLM system should use Bedrock and its support for RAG."

> "Let's always prefer simpler AWS-native options where possible in this project."

### Manual Update Strategy (User Input)
> "We will need to think about how the RAG system is fed updated manuals which can happen regularly. A possible trigger here is an upload a new version of a manual to S3 which triggers the system to update."

### Response Format Requirements (User Input)
> "The response is important in text as there may need to be detailed instructions, steps, and even mermaid diagrams for complicated instructions."

## Technology Stack Rationale

### React Native vs Swift Decision
**User Question**: "Can you say why you chose react native vs. something like swift and xcode?"

**Rationale Provided**:
- Cross-platform capability for future Android expansion
- JavaScript ecosystem consistency with Node.js backend
- Faster development cycle with hot reload
- Lower barrier to entry compared to Swift/iOS patterns
- User confirmed: "react native works"

### Key Architecture Decisions Made

1. **Vector Storage**: Bedrock Knowledge Base (AWS-native) over OpenSearch
   - User preference for simpler AWS-native solutions
   - Built-in RAG capabilities eliminate custom vector database management

2. **Document Processing**: Bedrock automatic parsing over custom preprocessing
   - User confirmed: "Yes, let's go with the automatic parsing since most documents (manuals) will be PDF"
   - Leverages Bedrock's built-in PDF, DOC, HTML, TXT support

3. **Authentication**: AWS Cognito from the start
   - User asked: "Is it easy to add Cognito later or is it better to start with Cognito"
   - Decision: Start with Cognito to avoid future refactoring complexity

4. **Rate Limiting**: User-based quotas via DynamoDB
   - User preference: "Let's do user based quotas" over simple API throttling
   - Cost control for Bedrock and Transcribe usage

## Project Scope & Constraints

### Primary Use Case
- Internal/personal tool for product manual queries
- Hold-to-record voice interface (no keyboard typing)
- Rich text responses with technical instructions and diagrams
- Automated manual ingestion and updates

### AWS Service Selection Criteria
- Prefer AWS-native solutions over third-party
- Minimize operational complexity
- Leverage managed services where possible
- Cost-conscious design with user quotas

### Technical Constraints
- iOS-first (React Native with Expo)
- PDF-primary manual format
- Voice-only input (no text input for queries)
- Real-time transcription feedback
- Mermaid diagram support in responses

## Critical Business Logic

### User Journey
1. User holds button → records audio question
2. Audio transcribed to text (shown to user for confirmation)
3. Text query sent to RAG system
4. LLM retrieves relevant manual sections
5. Generated response with instructions/diagrams displayed

### Quota System Design
- 50 queries per user per day
- 1000 queries per user per month
- DynamoDB tracking with user_id + date composite key
- Middleware enforcement before expensive operations

### Manual Management Flow
- S3 upload triggers automatic processing
- Bedrock Knowledge Base handles chunking and embedding
- Versioning support for manual updates
- Admin interface for manual management

## Development Approach

### Planning Philosophy
> "Let's spend time iterating on the plan before making any development. Only work in the specs folder if we have to keep notes."

### Implementation Strategy
- API-first development (backend before frontend)
- AWS infrastructure setup first
- Comprehensive testing before production
- Documentation-driven development

## Files Created
- `projectplan.md` - Complete technical specification with Mermaid diagrams
- `Context.md` - This contextual information file

## Next Steps
The project is ready for implementation following the 12-week timeline in `projectplan.md`. The next action would be to begin Phase 1 (Core Infrastructure) starting with AWS account setup and Cognito configuration.

## Key Success Criteria
- Audio transcription accuracy > 95%
- Query response time < 5 seconds
- Rich text rendering with mermaid diagrams
- Seamless manual update pipeline
- User-friendly iOS interface

## Important Notes
- This is designed as an internal/personal tool, not for App Store distribution
- TestFlight will be used for deployment
- Cost management is important due to Bedrock usage
- Security is handled through Cognito + API Gateway
- All AWS services should be in the same region for performance