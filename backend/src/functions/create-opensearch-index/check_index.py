"""
Simple script to check if OpenSearch index exists
"""
import json
import boto3
import urllib.request
import urllib.parse
import hashlib
import hmac
import datetime

def sign_request(method, url, data, headers, region, service):
    """Sign request using AWS Signature Version 4"""
    
    # Get credentials
    session = boto3.Session()
    credentials = session.get_credentials()
    
    # Parse URL
    parsed_url = urllib.parse.urlparse(url)
    host = parsed_url.netloc
    path = parsed_url.path if parsed_url.path else '/'
    
    # Create canonical request
    canonical_headers = f'host:{host}\n'
    signed_headers = 'host'
    
    payload_hash = hashlib.sha256(data.encode('utf-8')).hexdigest()
    canonical_request = f"{method}\n{path}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    
    # Create string to sign
    now = datetime.datetime.utcnow()
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')
    
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    
    # Calculate signature
    def get_signature_key(key, date_stamp, region_name, service_name):
        k_date = hmac.new(('AWS4' + key).encode('utf-8'), date_stamp.encode('utf-8'), hashlib.sha256).digest()
        k_region = hmac.new(k_date, region_name.encode('utf-8'), hashlib.sha256).digest()
        k_service = hmac.new(k_region, service_name.encode('utf-8'), hashlib.sha256).digest()
        k_signing = hmac.new(k_service, b'aws4_request', hashlib.sha256).digest()
        return k_signing
    
    signing_key = get_signature_key(credentials.secret_key, date_stamp, region, service)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # Create authorization header
    authorization_header = f"{algorithm} Credential={credentials.access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    
    # Add auth headers
    headers['Authorization'] = authorization_header
    headers['X-Amz-Date'] = amz_date
    headers['X-Amz-Content-SHA256'] = payload_hash
    
    if credentials.token:
        headers['X-Amz-Security-Token'] = credentials.token
    
    return headers

def check_index_exists(endpoint, index_name, region):
    """Check if OpenSearch index exists"""
    
    url = f"{endpoint}/{index_name}"
    data = ""
    
    parsed_url = urllib.parse.urlparse(url)
    
    headers = {
        'Host': parsed_url.netloc
    }
    
    # Sign the request
    headers = sign_request('HEAD', url, data, headers, region, 'aoss')
    
    # Create request
    req = urllib.request.Request(url, headers=headers, method='HEAD')
    
    try:
        # Send request
        with urllib.request.urlopen(req) as response:
            print(f"✅ Index '{index_name}' exists")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"❌ Index '{index_name}' does not exist")
            return False
        else:
            print(f"❌ Error checking index: {e.code} - {e.reason}")
            return False

if __name__ == "__main__":
    endpoint = "https://9zirlxsg545v92cnfucg.eu-west-1.aoss.amazonaws.com"
    index_name = "bedrock-kb-default-index"
    region = "eu-west-1"
    
    exists = check_index_exists(endpoint, index_name, region)
    exit(0 if exists else 1)