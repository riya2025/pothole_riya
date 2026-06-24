# Load Test Report — 50 Concurrent Users

## Test Overview

| Parameter | Value |
|---|---|
| Peak Concurrent Users | 50 |
| Total Requests | 168 |
| Total Failures | 6 |
| Overall Failure Rate | 3.57% |
| Aggregate Throughput | 0.95 requests/sec |
| Test Duration | ~175 seconds |

## Per-Endpoint Results

| Endpoint | Requests | Failures | Fail % | Median (ms) | Average (ms) | Min (ms) | Max (ms) | 95th %ile (ms) | 99th %ile (ms) | Req/s |
|---|---|---|---|---|---|---|---|---|---|---|
| `GET /api/issues` | 50 | 0 | 0.0% | 7,500 | 12,729 | 1,387 | 26,649 | 26,000 | 27,000 | 0.28 |
| `POST /api/issues/analyze` | 52 | 3 | 5.77% | 65,000 | 67,065 | 993 | 138,069 | 135,000 | 138,000 | 0.29 |
| `POST /api/issues/report` | 66 | 3 | 4.55% | 34,000 | 40,621 | 757 | 101,572 | 98,000 | 102,000 | 0.37 |
| **Aggregated** | **168** | **6** | **3.57%** | **29,000** | **40,505** | **757** | **138,069** | **102,000** | **136,000** | **0.95** |

## Response Time Percentiles (Aggregated, ms)

| Percentile | 50% | 66% | 75% | 80% | 90% | 95% | 98% | 99% | 100% |
|---|---|---|---|---|---|---|---|---|---|
| Response Time | 29,000 | 41,000 | 65,000 | 71,000 | 94,000 | 102,000 | 131,000 | 136,000 | 138,000 |

## Failures

| Method | Endpoint | Error | Occurrences |
|---|---|---|---|
| POST | `/api/issues/report` | HTTP 502 Bad Gateway | 3 |
| POST | `/api/issues/analyze` | HTTP 502 Bad Gateway | 3 |

No unhandled exceptions were recorded during the test.

## Observations

- **Read traffic is reliable but slow.** `GET /api/issues` had a 0% failure rate, but its median response time of 7.5 s and average of ~12.7 s are high for a read endpoint.
- **Write/processing endpoints are the bottleneck.** `POST /api/issues/analyze` is the heaviest operation, with a median of 65 s and a max of ~138 s. `POST /api/issues/report` is also slow (median 34 s, max ~102 s).
- **All failures were HTTP 502 (Bad Gateway).** This typically indicates the upstream server timed out or was overwhelmed under load, rather than an application-level bug.
- **Response times grew steadily as load ramped up.** The aggregated average climbed from ~1.7 s at 15 users to ~40 s near the 50-user peak, showing the system saturating under concurrent load.
- **Low overall throughput (~0.95 req/s)** reflects the long per-request processing times — requests are completing slowly, not arriving infrequently.

## Summary

Under 50 concurrent users the API stayed mostly available (96.4% success) but exhibited very high latency, especially on the `analyze` and `report` write endpoints. The 6 failures were all 502 Bad Gateway errors appearing as load peaked, suggesting upstream timeouts. The primary concern is response-time performance under concurrency rather than correctness.
