# Manuel - Rust Lambda Migration Plan

## Overview

This document outlines the migration strategy from Python to Rust for Manuel's
Lambda functions, ensuring zero downtime and maintaining the current working
system throughout the transition.

## Migration Principles

1. **No Breaking Changes**: Current Python functions remain untouched and
   operational
2. **Parallel Deployment**: Rust functions deployed alongside Python functions
3. **Gradual Cutover**: Traffic shifted incrementally with ability to rollback
4. **Performance Validation**: Benchmark before full migration
5. **Feature Parity**: Rust functions must match Python functionality exactly

## Architecture Strategy

### Directory Structure

```
backend/
├── src/
│   ├── functions/          # Current Python functions (unchanged)
│   │   ├── query/
│   │   ├── manuals/
│   │   └── ...
│   └── functions-rust/     # New Rust implementations
│       ├── query/
│       │   ├── Cargo.toml
│       │   └── src/
│       │       └── main.rs
│       ├── manuals/
│       └── shared/         # Shared Rust utilities
│           ├── auth/
│           ├── cost_calculator/
│           └── dynamodb/
├── template.yaml           # Current template (Python)
├── template-rust.yaml      # New template (Rust functions)
└── template-hybrid.yaml    # Hybrid deployment (both)
```

### Deployment Strategy

1. **Phase 1: Parallel Infrastructure**

   - Deploy Rust functions with different names (e.g., `QueryFunctionRust`)
   - Same IAM roles and permissions
   - Separate API Gateway routes for testing

2. **Phase 2: Load Balancer/Route53 Weighted Routing**

   - 95% traffic to Python, 5% to Rust initially
   - Monitor performance and errors
   - Gradually increase Rust traffic

3. **Phase 3: Full Migration**
   - 100% traffic to Rust
   - Keep Python functions deployed for quick rollback
   - Remove Python functions after 30-day validation

## Function Migration Priority

### High Priority (Core Business Logic)

1. **Query Function** - Most performance-critical

   - Bedrock API calls
   - Redis caching
   - Cost calculation

2. **Manuals Function** - Frequent API calls
   - S3 operations
   - DynamoDB queries

### Medium Priority

3. **PDF Page Function** - CPU intensive

   - Image processing
   - PDF manipulation

4. **Usage Function** - Database heavy
   - DynamoDB aggregations
   - Cost calculations

### Low Priority (Simple Functions)

5. **Auth Functions**
6. **Bootstrap Function**
7. **Health Check Function**

## Rust Lambda Architecture

### Technology Stack

```toml
# Cargo.toml base dependencies
[dependencies]
lambda_runtime = "0.8"
tokio = { version = "1", features = ["macros"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
aws-config = "1.0"
aws-sdk-bedrock = "1.0"
aws-sdk-bedrockagentruntime = "1.0"
aws-sdk-s3 = "1.0"
aws-sdk-dynamodb = "1.0"
aws-sdk-transcribe = "1.0"
redis = { version = "0.23", features = ["tokio-comp"] }
tracing = "0.1"
tracing-subscriber = "0.3"
anyhow = "1.0"
thiserror = "1.0"
```

### Function Template Structure

```rust
// src/functions-rust/query/src/main.rs
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use aws_sdk_bedrock::Client as BedrockClient;
use tracing::{info, error};

#[derive(Deserialize)]
struct Request {
    #[serde(rename = "queryStringParameters")]
    query_params: Option<QueryParams>,
    body: Option<String>,
    headers: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
struct QueryParams {
    query: String,
    sources: Option<bool>,
}

#[derive(Serialize)]
struct Response {
    #[serde(rename = "statusCode")]
    status_code: i32,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    run(service_fn(handler)).await
}

async fn handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let config = aws_config::load_from_env().await;
    let bedrock_client = BedrockClient::new(&config);

    // Implementation matching Python function behavior

    Ok(Response {
        status_code: 200,
        headers: create_cors_headers(),
        body: json_response,
    })
}
```

### Shared Utilities Design

```rust
// src/functions-rust/shared/src/lib.rs
pub mod auth {
    pub async fn verify_token(token: &str) -> Result<UserId, AuthError> {
        // JWT verification logic
    }
}

pub mod cost_calculator {
    pub struct ManuelCostCalculator;
    impl ManuelCostCalculator {
        pub fn calculate_request_cost(&self, usage: &Usage) -> Cost {
            // Cost calculation matching Python implementation
        }
    }
}

pub mod redis_cache {
    pub struct CacheClient {
        client: redis::aio::ConnectionManager,
    }

    impl CacheClient {
        pub async fn get_cached_query(&self, key: &str) -> Option<CachedResponse> {
            // Redis cache logic
        }
    }
}
```

## Build and Deployment

### SAM Configuration for Rust

```yaml
# template-rust.yaml
QueryFunctionRust:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "${ProjectName}-query-rust-${Stage}"
    CodeUri: src/functions-rust/query/
    Handler: bootstrap
    Runtime: provided.al2023
    Architecture: arm64 # Better price/performance for Rust
    MemorySize: 256 # Rust needs less memory than Python
    Timeout: 120
    Environment:
      Variables:
        RUST_LOG: info
        # Same env vars as Python function
  Metadata:
    BuildMethod: rust-cargolambda
```

### Build Process

```bash
# Install cargo-lambda
brew install cargo-lambda

# Build all Rust functions
cd backend
cargo lambda build --release --arm64

# Or use SAM with Rust support
sam build --use-container --build-image public.ecr.aws/sam/build-rust
```

## Testing Strategy

### 1. Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_query_handler() {
        // Test implementation
    }
}
```

### 2. Integration Tests

- Deploy to `dev-rust` stage
- Run existing test suite against Rust endpoints
- Compare responses with Python functions

### 3. Performance Benchmarks

```bash
# Benchmark script
artillery quick --count 100 --num 10 \
  https://api-python.manuel.com/query \
  https://api-rust.manuel.com/query
```

## Migration Checklist

### Per-Function Migration Steps

- [ ] Create Rust function structure
- [ ] Implement core business logic
- [ ] Add error handling matching Python
- [ ] Implement logging/monitoring
- [ ] Unit test coverage >90%
- [ ] Integration tests passing
- [ ] Performance benchmarks completed
- [ ] Deploy to dev environment
- [ ] Deploy to staging with canary
- [ ] Production deployment with monitoring
- [ ] 7-day production validation
- [ ] Remove Python function

## Performance Targets

### Expected Improvements

| Metric                    | Python Baseline | Rust Target | Notes            |
| ------------------------- | --------------- | ----------- | ---------------- |
| Cold Start                | 800-1200ms      | 50-200ms    | 80-90% reduction |
| Memory Usage              | 512MB           | 128-256MB   | 50-75% reduction |
| P99 Latency               | 2000ms          | 500ms       | 75% reduction    |
| Cost per Million Requests | $2.50           | $0.80       | 68% reduction    |

## Risk Mitigation

### Rollback Strategy

1. **Immediate**: Route 53 weighted routing back to Python
2. **API Gateway**: Stage variables to switch implementations
3. **Lambda Alias**: Point PROD alias back to Python version

### Monitoring During Migration

- CloudWatch custom metrics for Rust vs Python
- X-Ray traces comparing both implementations
- Dedicated dashboard for migration metrics
- Alerts for error rate differences >1%

## Development Guidelines

### Code Style

- Use `rustfmt` and `clippy` for consistency
- Follow Rust API guidelines
- Comprehensive error types with `thiserror`
- Structured logging with `tracing`

### Security Considerations

- Same security middleware patterns as Python
- Use `secrecy` crate for sensitive data
- Compile-time security with Rust's type system
- Regular `cargo audit` for dependencies

## Timeline Estimate

### Phase 1: Foundation (2 weeks)

- Set up Rust build pipeline
- Create shared utilities
- Implement first function (Health Check)

### Phase 2: Core Functions (4 weeks)

- Query function with Redis
- Manuals function
- Usage function
- Comprehensive testing

### Phase 3: Complex Functions (3 weeks)

- PDF processing (may need `pdfium` bindings)
- Voice query with Transcribe
- Bootstrap and ingestion

### Phase 4: Production Rollout (2 weeks)

- Canary deployments
- Performance validation
- Gradual traffic shift
- Full cutover

**Total Timeline: 11 weeks** with parallel Python operation throughout

## Success Criteria

1. **Feature Parity**: All Python functionality replicated
2. **Performance**: Meet or exceed all performance targets
3. **Reliability**: Error rate equal or better than Python
4. **Cost**: 50%+ reduction in Lambda costs
5. **Maintainability**: Easier to modify and extend

## Next Steps

1. Create `backend/src/functions-rust/` directory structure
2. Set up Rust toolchain and cargo-lambda
3. Implement health check function as proof of concept
4. Create performance benchmark suite
5. Begin with Query function migration
