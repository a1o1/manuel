#!/usr/bin/env python3
"""
Integration Test Runner for Manuel Backend
Provides CLI interface for running comprehensive integration tests
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, Optional

# Add the src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

from test_framework import IntegrationTestFramework, TestConfig, run_integration_tests


class TestRunner:
    """Main test runner with CLI interface"""

    def __init__(self):
        self.results = None
        self.start_time = None
        self.end_time = None

    def run_tests(self, args: argparse.Namespace) -> Dict[str, Any]:
        """Run integration tests with specified configuration"""

        # Load test configuration
        config = self._load_test_config(args)

        # Print test configuration
        self._print_test_info(config, args)

        # Run tests
        self.start_time = time.time()
        try:
            if args.framework:
                # Use the framework class directly
                framework = IntegrationTestFramework(config)
                self.results = framework.run_all_tests()
            else:
                # Use the convenience function
                self.results = run_integration_tests(args.config)
        except Exception as e:
            print(f"❌ Test execution failed: {str(e)}")
            return {
                "summary": {
                    "total_tests": 0,
                    "passed": 0,
                    "failed": 1,
                    "success_rate": 0,
                    "error": str(e),
                }
            }
        finally:
            self.end_time = time.time()

        # Generate and display results
        self._display_results(args)

        # Save results if requested
        if args.output:
            self._save_results(args.output)

        return self.results

    def _load_test_config(self, args: argparse.Namespace) -> TestConfig:
        """Load test configuration from file or defaults"""

        if args.config:
            try:
                with open(args.config, "r") as f:
                    config_data = json.load(f)

                # Handle environment-specific config
                if args.environment and "test_environments" in config_data:
                    env_config = config_data.get("test_environments", {}).get(
                        args.environment, {}
                    )
                    config_data.update(env_config)

                return TestConfig(**config_data)
            except FileNotFoundError:
                print(f"⚠️  Config file not found: {args.config}")
                print("Using default configuration...")
            except json.JSONDecodeError as e:
                print(f"⚠️  Invalid JSON in config file: {e}")
                print("Using default configuration...")

        # Apply command line overrides
        config_data = {}
        if args.api_url:
            config_data["api_base_url"] = args.api_url
        if args.timeout:
            config_data["timeout_seconds"] = args.timeout
        if args.parallel:
            config_data["parallel_tests"] = args.parallel

        # Enable test types based on flags
        if args.chaos:
            config_data["enable_chaos_testing"] = True
        if args.load:
            config_data["enable_load_testing"] = True
        if args.security:
            config_data["enable_security_testing"] = True

        return TestConfig(**config_data)

    def _print_test_info(self, config: TestConfig, args: argparse.Namespace):
        """Print test configuration and info"""

        print("🚀 Manuel Backend Integration Tests")
        print("=" * 50)
        print(f"Environment: {args.environment or 'default'}")
        print(f"API URL: {config.api_base_url}")
        print(f"Timeout: {config.timeout_seconds}s")
        print(f"Parallel Tests: {config.parallel_tests}")
        print(f"Chaos Testing: {'✓' if config.enable_chaos_testing else '✗'}")
        print(f"Load Testing: {'✓' if config.enable_load_testing else '✗'}")
        print(f"Security Testing: {'✓' if config.enable_security_testing else '✗'}")
        print("-" * 50)
        print()

    def _display_results(self, args: argparse.Namespace):
        """Display test results in a formatted way"""

        if not self.results:
            print("❌ No test results available")
            return

        summary = self.results.get("summary", {})

        print()
        print("📊 Test Results Summary")
        print("=" * 50)

        # Overall statistics
        total_tests = summary.get("total_tests", 0)
        passed = summary.get("passed", 0)
        failed = summary.get("failed", 0)
        skipped = summary.get("skipped", 0)
        success_rate = summary.get("success_rate", 0)

        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed} ✓")
        print(f"Failed: {failed} ✗")
        print(f"Skipped: {skipped} ⏭️")
        print(f"Success Rate: {success_rate:.1f}%")

        # Duration information
        if self.start_time and self.end_time:
            duration = self.end_time - self.start_time
            print(f"Total Duration: {duration:.2f}s")

        total_duration = summary.get("total_duration_ms", 0)
        avg_duration = summary.get("average_test_duration_ms", 0)
        print(f"Test Duration: {total_duration:.0f}ms")
        print(f"Average Test Duration: {avg_duration:.0f}ms")

        # Performance metrics
        if "performance_metrics" in self.results:
            perf = self.results["performance_metrics"]
            print()
            print("⚡ Performance Metrics")
            print("-" * 30)
            print(f"Min Duration: {perf.get('min_duration_ms', 0):.0f}ms")
            print(f"Max Duration: {perf.get('max_duration_ms', 0):.0f}ms")
            print(f"P95 Duration: {perf.get('p95_duration_ms', 0):.0f}ms")
            print(f"P99 Duration: {perf.get('p99_duration_ms', 0):.0f}ms")

        # Failed tests details
        failed_tests = self.results.get("failed_tests", [])
        if failed_tests and args.verbose:
            print()
            print("❌ Failed Tests Details")
            print("-" * 30)
            for test in failed_tests:
                print(
                    f"• {test['test_name']}: {test.get('error_message', 'Unknown error')}"
                )

        # Overall result
        print()
        if success_rate >= 95:
            print("🎉 All tests passed successfully!")
        elif success_rate >= 80:
            print("⚠️  Some tests failed, but overall success rate is acceptable.")
        else:
            print("❌ Too many tests failed. Please review the results.")

        print("=" * 50)

    def _save_results(self, output_file: str):
        """Save test results to file"""

        if not self.results:
            print(f"⚠️  No results to save")
            return

        try:
            # Add timestamp to results
            self.results["timestamp"] = datetime.utcnow().isoformat()
            if self.start_time:
                self.results["start_time"] = datetime.fromtimestamp(
                    self.start_time
                ).isoformat()
            if self.end_time:
                self.results["end_time"] = datetime.fromtimestamp(
                    self.end_time
                ).isoformat()

            with open(output_file, "w") as f:
                json.dump(self.results, f, indent=2)

            print(f"📄 Results saved to: {output_file}")
        except Exception as e:
            print(f"⚠️  Failed to save results: {str(e)}")


def main():
    """Main CLI entry point"""

    parser = argparse.ArgumentParser(
        description="Manuel Backend Integration Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all tests with default config
  python test_runner.py

  # Run tests with custom config
  python test_runner.py --config test_config.json

  # Run tests for specific environment
  python test_runner.py --environment staging --config test_config.json

  # Run with specific test types
  python test_runner.py --chaos --load --security

  # Run with custom API URL
  python test_runner.py --api-url https://api.manuel.example.com

  # Save results to file
  python test_runner.py --output results.json --verbose
        """,
    )

    # Configuration options
    parser.add_argument(
        "--config",
        "-c",
        type=str,
        default="test_config.json",
        help="Path to test configuration file",
    )

    parser.add_argument(
        "--environment",
        "-e",
        type=str,
        choices=["dev", "staging", "prod"],
        help="Test environment (overrides config file settings)",
    )

    # Test execution options
    parser.add_argument(
        "--api-url", type=str, help="API base URL (overrides config file)"
    )

    parser.add_argument(
        "--timeout", type=int, help="Request timeout in seconds (overrides config file)"
    )

    parser.add_argument(
        "--parallel", type=int, help="Number of parallel tests (overrides config file)"
    )

    # Test type flags
    parser.add_argument(
        "--chaos", action="store_true", help="Enable chaos testing (failure scenarios)"
    )

    parser.add_argument("--load", action="store_true", help="Enable load testing")

    parser.add_argument(
        "--security", action="store_true", help="Enable security testing"
    )

    # Output options
    parser.add_argument("--output", "-o", type=str, help="Save results to JSON file")

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed output including failed test details",
    )

    # Framework options
    parser.add_argument(
        "--framework",
        action="store_true",
        help="Use IntegrationTestFramework class directly",
    )

    # Parse arguments
    args = parser.parse_args()

    # Run tests
    runner = TestRunner()
    results = runner.run_tests(args)

    # Exit with appropriate code
    if results and "summary" in results:
        success_rate = results["summary"].get("success_rate", 0)
        sys.exit(0 if success_rate >= 95 else 1)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
