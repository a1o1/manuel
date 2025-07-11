"""
Manuel - Query Function
Handles RAG-powered question answering using AWS Bedrock
"""
import json
import os
import time
from typing import Dict, Any
import boto3
from botocore.exceptions import ClientError
import sys
sys.path.append('/opt/python')
sys.path.append('../../shared')

from utils import (
    create_response, 
    get_user_id_from_event, 
    UsageTracker,
    validate_json_body,
    handle_options_request
)
from logger import get_logger, LoggingContext
from cost_calculator import get_cost_calculator
from health_checker import get_health_checker, CircuitBreakerOpenError
from api_versioning import get_versioning_handler
from security_middleware import get_security_middleware
from advanced_error_handler import get_error_handler, ErrorContext
from performance_optimizer import get_performance_optimizer


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle query requests using Bedrock RAG
    
    Expected request:
    {
        "question": "How do I configure the wireless settings?"
    }
    """
    start_time = time.time()
    logger = get_logger("manuel-query", context)
    cost_calculator = get_cost_calculator()
    health_checker = get_health_checker()
    versioning_handler = get_versioning_handler()
    
    # Initialize error handler
    error_handler = None
    if os.environ.get('ENABLE_ADVANCED_ERROR_HANDLING', 'false').lower() == 'true':
        error_handler = get_error_handler("query", context)
    
    # Initialize performance optimizer
    performance_optimizer = None
    if os.environ.get('ENABLE_PERFORMANCE_OPTIMIZATION', 'false').lower() == 'true':
        performance_optimizer = get_performance_optimizer("query")
    
    # Security validation (if enabled)
    if os.environ.get('ENABLE_ADVANCED_SECURITY', 'false').lower() == 'true':
        security_middleware = get_security_middleware("query")
        is_valid, error_response = security_middleware.validate_request(event, context)
        if not is_valid:
            return security_middleware.add_security_headers(error_response)
    
    # Initialize cost tracking parameters
    cost_params = {
        "lambda_duration_ms": 0,
        "lambda_memory_mb": int(os.environ.get('AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 256)),
        "dynamodb_reads": 1,  # Quota check read
        "dynamodb_writes": 1,  # Quota update write
        "embedding_tokens": 0,
        "text_input_tokens": 0,
        "text_output_tokens": 0,
        "text_model": os.environ.get('TEXT_MODEL_ID', ''),
        "embedding_model": os.environ.get('EMBEDDING_MODEL_ID', '')
    }
    
    try:
        logger.log_request_start(event)
        
        # Handle CORS preflight
        if event['httpMethod'] == 'OPTIONS':
            response = handle_options_request()
            logger.log_request_end(200, (time.time() - start_time) * 1000)
            return response
        
        # Extract and validate API version
        versioned_request = versioning_handler.normalize_request(event)
        is_supported, version_warning = versioning_handler.validate_version_compatibility(versioned_request.version)
        
        if not is_supported:
            logger.warning("Unsupported API version", 
                          requested_version=versioned_request.version.value,
                          error=version_warning)
            return create_versioned_api_response(
                {'error': version_warning}, 
                versioned_request.version, 
                versioning_handler,
                400
            )
        
        logger.info("API version detected", 
                   version=versioned_request.version.value,
                   warning=version_warning)
        
        # Get user ID from JWT token
        user_id = get_user_id_from_event(event)
        if not user_id:
            logger.warning("Unauthorized request - no user ID")
            response = create_response(401, {'error': 'Unauthorized'})
            logger.log_request_end(401, (time.time() - start_time) * 1000)
            return response
        
        logger.info("Processing query request", user_id=user_id)
        
        # Use normalized request body (handles version-specific transformations)
        body = versioned_request.normalized_body
        
        # Validate required fields
        if not body.get('question'):
            logger.warning("Missing question in request body")
            return create_versioned_api_response(
                {'error': 'Question is required'}, 
                versioned_request.version, 
                versioning_handler,
                400
            )
        
        question = body['question'].strip()
        if not question:
            logger.warning("Empty question provided")
            return create_versioned_api_response(
                {'error': 'Question cannot be empty'}, 
                versioned_request.version, 
                versioning_handler,
                400
            )
        
        logger.info("Question received", question_length=len(question))
        
        # Check usage quota
        with LoggingContext(logger, "QuotaCheck"):
            usage_tracker = UsageTracker()
            can_proceed, usage_info = usage_tracker.check_and_increment_usage(user_id, 'query')
            logger.log_quota_check(user_id, 'query', can_proceed, usage_info)
        
        if not can_proceed:
            logger.warning("Quota exceeded", user_id=user_id, usage_info=usage_info)
            response = create_response(429, usage_info)
            logger.log_request_end(429, (time.time() - start_time) * 1000)
            return response
        
        try:
            # Get relevant context from Knowledge Base
            with LoggingContext(logger, "KnowledgeBaseRetrieval"):
                relevant_context, embedding_cost_info = retrieve_relevant_context(question, logger, cost_params, health_checker, performance_optimizer)
            
            # Generate answer using Bedrock
            with LoggingContext(logger, "AnswerGeneration"):
                answer, generation_cost_info = generate_answer(question, relevant_context, logger, cost_params, health_checker, performance_optimizer)
            
            # Calculate final costs
            cost_params["lambda_duration_ms"] = (time.time() - start_time) * 1000
            
            request_cost = cost_calculator.calculate_request_cost(
                context.aws_request_id if context else "unknown",
                user_id,
                "query",
                **cost_params
            )
            
            # Emit cost metrics and store cost data
            cost_calculator.emit_cost_metrics(request_cost)
            cost_calculator.store_cost_data(request_cost)
            
            logger.info("Query processing completed successfully", 
                       context_count=len(relevant_context),
                       answer_length=len(answer),
                       total_cost=request_cost.total_cost,
                       cost_breakdown=len(request_cost.service_costs))
            
            response_data = {
                'answer': answer,
                'context_used': len(relevant_context),
                'usage': usage_info,
                'cost': request_cost.to_dict()
            }
            
            # Add version warning if applicable
            if version_warning:
                response_data['warning'] = version_warning
            
            response = create_versioned_api_response(response_data, versioned_request.version, versioning_handler)
            logger.log_request_end(200, (time.time() - start_time) * 1000, 
                                 context_used=len(relevant_context),
                                 total_cost=request_cost.total_cost)
            return response
            
        except CircuitBreakerOpenError as e:
            logger.warning("Circuit breaker open during query processing", 
                          error=str(e),
                          user_id=user_id,
                          question_length=len(question))
            response = create_response(503, {
                'error': 'Service temporarily unavailable',
                'details': 'One or more required services are currently unavailable. Please try again later.',
                'retry_after': 60
            })
            logger.log_request_end(503, (time.time() - start_time) * 1000)
            return response
        except Exception as e:
            logger.error("Error in query processing", 
                        error=str(e), 
                        error_type=type(e).__name__,
                        user_id=user_id,
                        question_length=len(question))
            response = create_response(500, {'error': 'Query processing failed'})
            logger.log_request_end(500, (time.time() - start_time) * 1000)
            return response
        
    except Exception as e:
        logger.error("Unexpected error in lambda handler", 
                    error=str(e), 
                    error_type=type(e).__name__)
        response = create_response(500, {'error': 'Internal server error'})
        logger.log_request_end(500, (time.time() - start_time) * 1000)
        return response


def retrieve_relevant_context(question: str, logger, cost_params: dict, health_checker, performance_optimizer=None) -> tuple:
    """Retrieve relevant context from Bedrock Knowledge Base"""
    # Use performance optimizer for optimized client if available
    if performance_optimizer:
        bedrock_client = performance_optimizer.connection_pool.get_bedrock_agent_client()
    else:
        bedrock_client = boto3.client('bedrock-agent-runtime')
    
    knowledge_base_id = os.environ['KNOWLEDGE_BASE_ID']
    max_results = int(os.environ.get('KNOWLEDGE_BASE_RETRIEVAL_RESULTS', 5))
    
    start_time = time.time()
    
    # Check cache first if performance optimization is enabled
    if performance_optimizer:
        cached_results = performance_optimizer.get_cached_knowledge_base_results(
            knowledge_base_id, question
        )
        if cached_results:
            logger.info("Knowledge base results retrieved from cache", 
                       knowledge_base_id=knowledge_base_id,
                       result_count=len(cached_results))
            return cached_results
    
    try:
        logger.info("Starting knowledge base retrieval", 
                   knowledge_base_id=knowledge_base_id,
                   max_results=max_results)
        
        # Use circuit breaker for Knowledge Base calls
        def kb_retrieve():
            return bedrock_client.retrieve(
                knowledgeBaseId=knowledge_base_id,
                retrievalQuery={
                    'text': question
                },
                retrievalConfiguration={
                    'vectorSearchConfiguration': {
                        'numberOfResults': max_results,
                        'overrideSearchType': 'HYBRID'
                    }
                }
            )
        
        # Use error handler with retry logic if enabled
        if error_handler:
            error_context = ErrorContext(
                function_name="query",
                request_id=context.aws_request_id,
                user_id=user_id,
                operation="bedrock_knowledge_base_retrieve",
                error_details={"knowledge_base_id": knowledge_base_id, "question": question}
            )
            response = error_handler.handle_with_retry(
                lambda: health_checker.circuit_breakers["knowledge_base"].call(kb_retrieve),
                "bedrock",
                error_context=error_context
            )
        else:
            response = health_checker.circuit_breakers["knowledge_base"].call(kb_retrieve)
        
        # Extract relevant passages
        context_passages = []
        for result in response.get('retrievalResults', []):
            content = result.get('content', {})
            text = content.get('text', '')
            
            # Get metadata for source information
            metadata = result.get('metadata', {})
            source = metadata.get('source', 'Unknown')
            
            if text:
                context_passages.append({
                    'text': text,
                    'source': source,
                    'score': result.get('score', 0.0)
                })
        
        duration_ms = (time.time() - start_time) * 1000
        
        # Estimate embedding tokens for cost calculation
        # Knowledge Base queries typically embed the question
        estimated_embedding_tokens = len(question) // 4  # Rough estimate: 4 chars per token
        cost_params["embedding_tokens"] = estimated_embedding_tokens
        
        logger.log_knowledge_base_query(question, len(context_passages), duration_ms, True)
        
        # Cache the results if performance optimization is enabled
        if performance_optimizer:
            performance_optimizer.cache_knowledge_base_results(
                knowledge_base_id, question, context_passages
            )
        
        cost_info = {
            "embedding_tokens": estimated_embedding_tokens,
            "results_count": len(context_passages)
        }
        
        return context_passages, cost_info
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.log_knowledge_base_query(question, 0, duration_ms, False)
        logger.error("Error retrieving context", error=str(e), error_type=type(e).__name__)
        return [], {"embedding_tokens": 0, "results_count": 0}


def generate_answer(question: str, context_passages: list, logger, cost_params: dict, health_checker, performance_optimizer=None) -> tuple:
    """Generate answer using Bedrock with retrieved context"""
    # Use performance optimizer for optimized client if available
    if performance_optimizer:
        bedrock_client = performance_optimizer.connection_pool.get_bedrock_client()
    else:
        bedrock_client = boto3.client('bedrock-runtime')
    
    model_id = os.environ['TEXT_MODEL_ID']
    
    start_time = time.time()
    
    # Build context string
    context_text = ""
    if context_passages:
        context_text = "Based on the following information from the product manuals:\n\n"
        for i, passage in enumerate(context_passages, 1):
            context_text += f"Source {i} ({passage['source']}):\n{passage['text']}\n\n"
    
    # Create prompt
    prompt = build_prompt(question, context_text)
    
    # Check cache first if performance optimization is enabled
    if performance_optimizer:
        cached_response = performance_optimizer.get_cached_bedrock_response(
            model_id, prompt
        )
        if cached_response:
            logger.info("Bedrock response retrieved from cache", 
                       model_id=model_id,
                       prompt_length=len(prompt))
            return cached_response, {"input_tokens": 0, "output_tokens": 0}
    
    logger.info("Starting answer generation", 
               model_id=model_id,
               context_passages_count=len(context_passages),
               prompt_length=len(prompt))
    
    try:
        # Use circuit breaker for Bedrock calls
        def bedrock_invoke():
            return bedrock_client.invoke_model(
                modelId=model_id,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.1,
                    "top_p": 0.9
                })
            )
        
        # Use error handler with retry logic if enabled
        if error_handler:
            error_context = ErrorContext(
                function_name="query",
                request_id=context.aws_request_id,
                user_id=user_id,
                operation="bedrock_invoke_model",
                error_details={"model_id": model_id, "question": question}
            )
            response = error_handler.handle_with_retry(
                lambda: health_checker.circuit_breakers["bedrock"].call(bedrock_invoke),
                "bedrock",
                error_context=error_context
            )
        else:
            response = health_checker.circuit_breakers["bedrock"].call(bedrock_invoke)
        
        # Parse response
        response_body = json.loads(response['body'].read())
        answer = response_body['content'][0]['text']
        
        # Extract token usage if available
        usage = response_body.get('usage', {})
        input_tokens = usage.get('input_tokens', 0)
        output_tokens = usage.get('output_tokens', 0)
        total_tokens = input_tokens + output_tokens
        
        # If usage not provided, estimate from text
        if input_tokens == 0:
            input_tokens = len(prompt) // 4  # Rough estimate
        if output_tokens == 0:
            output_tokens = len(answer) // 4  # Rough estimate
        
        # Update cost parameters
        cost_params["text_input_tokens"] = input_tokens
        cost_params["text_output_tokens"] = output_tokens
        
        duration_ms = (time.time() - start_time) * 1000
        
        logger.log_bedrock_call(model_id, "text_generation", duration_ms, total_tokens, True)
        logger.info("Answer generation completed", 
                   input_tokens=input_tokens,
                   output_tokens=output_tokens,
                   answer_length=len(answer))
        
        # Cache the response if performance optimization is enabled
        if performance_optimizer:
            performance_optimizer.cache_bedrock_response(model_id, prompt, answer)
        
        cost_info = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model_id": model_id
        }
        
        return answer.strip(), cost_info
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.log_bedrock_call(model_id, "text_generation", duration_ms, None, False)
        logger.error("Error generating answer", 
                    error=str(e), 
                    error_type=type(e).__name__,
                    model_id=model_id)
        
        cost_info = {
            "input_tokens": 0,
            "output_tokens": 0,
            "model_id": model_id
        }
        
        return "I apologize, but I'm having trouble processing your question right now. Please try again later.", cost_info


def build_prompt(question: str, context_text: str) -> str:
    """Build the prompt for the language model"""
    
    base_prompt = """You are Manuel, an intelligent assistant that helps users with questions about product manuals. Your role is to provide clear, accurate, and helpful answers based on the product documentation provided.

Guidelines:
1. Answer questions directly and clearly
2. Use the provided manual context when available
3. If you need to provide step-by-step instructions, format them as numbered lists
4. For complex procedures, you can suggest creating diagrams using mermaid syntax
5. If the context doesn't contain enough information, say so honestly
6. Always be helpful and professional
7. Focus on practical, actionable advice

"""
    
    if context_text:
        prompt = f"{base_prompt}\n{context_text}\n\nUser Question: {question}\n\nAnswer:"
    else:
        prompt = f"{base_prompt}\n\nNote: No specific manual context was found for this question. Please provide a general helpful response or ask the user to rephrase their question.\n\nUser Question: {question}\n\nAnswer:"
    
    return prompt


def format_response_with_sources(answer: str, context_passages: list) -> str:
    """Add source information to the answer"""
    if not context_passages:
        return answer
    
    # Add sources section
    sources = []
    for passage in context_passages:
        if passage['source'] not in sources:
            sources.append(passage['source'])
    
    if sources:
        answer += f"\n\n**Sources:**\n"
        for source in sources:
            answer += f"- {source}\n"
    
    return answer


def create_versioned_api_response(data: dict, version, handler, status_code: int = 200) -> dict:
    """Create a versioned API response"""
    import json
    
    versioned_response = handler.format_response(version, data, status_code)
    version_headers = handler.create_version_headers(version)
    
    response = {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,API-Version',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            **version_headers
        },
        'body': json.dumps(versioned_response.data)
    }
    
    # Add security headers if security is enabled
    if os.environ.get('ENABLE_ADVANCED_SECURITY', 'false').lower() == 'true':
        security_middleware = get_security_middleware("query")
        response = security_middleware.add_security_headers(response)
    
    return response