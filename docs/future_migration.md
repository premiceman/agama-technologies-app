# future_migration.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Architectural Migration Roadmap (MVP → Enterprise Cloud)
Last Updated: 2025-12-07

This document defines how Agama will evolve from its current development environment (Render + MongoDB Atlas) to a **fully enterprise-grade production environment** on AWS or GCP. The migration plan focuses on scalability, security, performance, observability, multi-tenancy, data governance, and compliance — ensuring Agama can support large global customers.

---

# Licensing & Suites Refactor

Agama’s licensing model now aligns to suites and seats instead of the legacy personal tier framing.

- **Removed concepts:**
  - `licenseTier` (personal/free variations)
  - `platformAccess`
  - `valueAssessmentLimit`
  - `sharedSuiteEnabled`
- **New concepts:**
  - Suite selection is explicit: **Vendor Suite**, **Buyer Suite**, **Both Suites**, or **Guest** access.
  - Organizations define **seatLimits per suite**, enabling separate capacity controls for vendor and buyer usage.
  - User `persona` enum is normalized to `vendor` | `buyer` | `both` (replacing the former `dual`).
  - Pricing is **USD per-seat** with a **200-seat threshold** guiding enterprise packaging.

Expected data migrations:

- Migrate any user with persona `dual` to `both`.
- Legacy licensing fields above can be dropped or ignored going forward.

---

# 1. Current Architecture (MVP Baseline)

Agama currently runs on:

- **Render** for application hosting  
- **MongoDB Atlas** as its primary database  
- **WorkOS** for identity/SSO  
- **Minimal static file hosting**  
- **No dedicated background workers**  
- **No dedicated queue system**  
- **No VPC or private networking**  
- **Limited observability**  

This stack is excellent for rapid prototyping but insufficient for enterprise scale due to:

- Cold starts under load  
- Limited horizontal scaling  
- Lack of multi-service orchestration  
- Limited runtime memory and CPU isolation  
- Missing VPC peering for secure integration with enterprise systems  
- No proper queues for ingestion-heavy integrations  
- No multi-region deployment strategy  

---

# 2. Target Architecture Overview (Enterprise Cloud)

Agama will migrate to a **containerised microservice architecture** deployed on AWS or GCP:

## 2.1 Compute Layer
Options:

- **AWS ECS Fargate** (recommended)  
- AWS EKS (Kubernetes) (future)  
- GCP Cloud Run (alternative)

Services include:

- API Service  
- Web frontend service  
- Real-time Collaboration Engine  
- Background worker service  
- Integration pipeline services  
- AI inference service  
- Notification dispatch service  

Each service lives in its own container, autoscaled independently.

## 2.2 Networking & Security
- Private VPC  
- Public/private subnets  
- VPC peering with MongoDB Atlas  
- NAT gateways  
- Load balancer (ALB or NLB)  
- Security groups / firewall rules  
- TLS termination at the load balancer  

## 2.3 Storage
- **MongoDB Atlas** continues as the primary database  
- **S3** for documents, architecture assets, RFX attachments  
- **S3 Glacier** for long-term audit retention  
- **Redis (ElastiCache)** for caching and WebSocket fan-out  
- Optional: Postgres for billing/transactional data split  

## 2.4 Queueing and Event Processing
Use **AWS SQS** + **EventBridge**:

- Integrations (CRM, Gong, Clari, ERP)  
- Notification fan-out  
- AI processing tasks  
- Document version extraction  
- Audit log processing  
- Reconciliation/cleanup tasks  

Queues allow reliable, scalable ingestion.

## 2.5 Real-Time Collaboration Infrastructure
Real-time engine uses:

- WebSockets served via ECS/EKS  
- Redis pub/sub for fan-out  
- Optional: AWS AppSync or API Gateway WebSocket mode  
- Horizontal scaling via sticky sessions or connection registries  

---

# 3. Migration Strategy (Phased Approach)

Migration proceeds in controlled steps:

## Phase 1 — Pre-Migration Hardening (Still on Render)
- Implement domain boundaries  
- Implement background workers (via Render cron/worker)  
- Extract integration jobs into services  
- Implement permission middleware  
- Build audit logging  
- Build notification pipeline  
- Add caching for search and Rooms  
- Stabilise API contracts  

Deliverables:
- Clean service boundaries  
- Predictable performance  
- MVP-ready real-time backbone  

## Phase 2 — Containerisation (Local / Dev / QA)
- Dockerise the application  
- Split backend into services:
  1. Core API  
  2. Real-time server  
  3. Integration worker  
  4. Notification worker  
  5. AI inference service (optional)
- Add proper health checks  
- Add environment variable profiles  

Deliverables:
- Fully containerised stack  
- Local orchestration via Docker Compose or Minikube  

## Phase 3 — Deploy to AWS (Initial)
- Deploy containers to ECS Fargate  
- Introduce ALB for routing  
- Move all secrets into AWS Secrets Manager  
- Move static files to S3 + CloudFront  
- Set up Redis/ElastiCache  
- Set up SQS + EventBridge for worker tasks  
- Set up CloudWatch for logs/metrics  
- Connect VPC to MongoDB Atlas via private peering  

Deliverables:
- Fully cloud-native infrastructure  
- Initial autoscaling capable  
- Real-time engine stable under load  

## Phase 4 — Enterprise-Hardening & Scaling
- Add multi-region readiness  
- Add blue/green or canary deployments  
- Implement advanced IAM boundaries  
- Integrate AWS WAF  
- Add configurable data retention policies  
- Add audit export tool  
- Add full-text search cluster (OpenSearch)  

Deliverables:
- Enterprise production-ready platform  

## Phase 5 — Optional Future Optimisations
- Move from ECS → EKS (if necessary)  
- Deploy inference models closer to edge  
- Implement event sourcing architecture  
- Multi-region active/active redundancy  
- PrivateLink for customers with strict network isolation  

---

# 4. Service Decomposition Strategy

Agama backend should be decomposed into modular services:

## 4.1 Core API Service
Handles:
- Auth  
- REST APIs  
- Permission checks  
- Orchestrates business logic  

## 4.2 Real-Time Service
Handles:
- WebSockets  
- Presence  
- Typing indicators  
- Room event fan-out  
- Works closely with Redis  

## 4.3 Integrations Worker
Processes:
- CRM syncs  
- Gong ingestion  
- Clari signals  
- Email/calendar  
- ERP integrations  
- Risk feed ingestion  

## 4.4 Notification Worker
Processes:
- Notification creation  
- Email dispatch (future)  
- Push notifications (future)  

## 4.5 AI Worker (Optional)
Processes:
- Summaries  
- Draft responses (seller-side)  
- RFX scoring suggestions (buyer-only)  
- Shared ValueSphere summarisation  

## 4.6 Document Processor
Processes:
- Document metadata extraction  
- Virus scanning  
- Classification for search indexing  

---

# 5. Data Architecture Evolution

## 5.1 MongoDB Atlas
Remains core database.

Enterprise improvements:
- Shared cluster → dedicated cluster  
- Multi-region read replicas  
- VPC peering  
- Advanced backup policies  
- PITR (point in time restore)  

## 5.2 Search Layer
Phase 2 migration uses **OpenSearch** or **Elastic Cloud**.

Use cases:
- Full-text search  
- Semantic search  
- RFX response indexing  
- Document extraction indexing  
- Room message indexing  
- ValueSphere summarisation  

## 5.3 Cache + Real-Time Data
Use **Redis** for:
- WebSocket fan-out  
- Presence tracking  
- Caching heavy queries  
- Rate limiting  

## 5.4 File Storage
Use **S3**:
- Document storage  
- Architecture assets  
- RFX attachments  
- ValueSphere exports  
- Audit exports  

Lifecycle rules must move old files to Glacier.

---

# 6. Security & Compliance Architecture

## 6.1 Identity / Access
- WorkOS for SSO  
- JWTs for API auth  
- Strict org-bound token scoping  
- Signed URLs for S3  

## 6.2 Network Security
- VPC isolation  
- Private subnets for services  
- No public access to internal workers  
- IP restrictions for enterprise customers (optional)  

## 6.3 Data Encryption
- TLS everywhere  
- AES-256 at rest (MongoDB Atlas)  
- KMS-managed keys  

## 6.4 Logging & Monitoring
- CloudWatch logs  
- CloudWatch metrics  
- Alarms for:
  - Integration failures  
  - WebSocket overload  
  - Worker backlogs  
  - API latency spikes  

## 6.5 Compliance Prep
- SOC2 alignment  
- ISO 27001 ready  
- GDPR support (redaction pipeline)  
- Audit event immutability  

### 8.6 SLA and Reliability Targets

Enterprise environments require the following minimum SLAs:

- API availability: 99.9%
- Real-time engine uptime: 99.5%
- Integration processing uptime: 99.5%
- Data durability (MongoDB Atlas): 99.999%
- Recovery Point Objective (RPO): < 5 minutes
- Recovery Time Objective (RTO): < 15 minutes

AWS/GCP deployment must support:
- Multi-AZ failover
- Graceful service degradation under load
- Automated recovery from node or container failures


---

# 7. High Availability Architecture

Agama must support:

- Multi-AZ deployment  
- Autoscaling on CPU and connections  
- Load balancing  
- Failover for Redis  
- Read replicas for MongoDB  
- Retry strategies for worker queues  

For real-time needs:
- Sticky WebSocket sessions  
- Graceful reconnect logic  
- Rolling updates with zero downtime  

---

# 8. Cost Efficiency Strategy

Agama must be cost-aware while scaling:

- ECS Fargate autoscaling  
- Spot instances for non-critical workloads (AI inference)  
- Storage tiering in S3  
- Scaling Redis cluster based on usage  
- Auto-freeze cold RFX or archived Rooms  

---

# 9. Migration Risks & Safeguards

Risks:
- Breaking changes to real-time engine  
- Multi-tenant data boundary issues  
- Downtime during migration  
- Integration backlogs  
- Token invalidation across deployments  

Safeguards:
- Staged cutover  
- Canary releases  
- Rolling migrations  
- Dual-write phase for integration workers (optional)  
- Side-by-side environment testing  

---

# 10. WorkOS VPC Peering (Enterprise Requirement)

For enterprise customers requiring private networking:
- Agama must support optional VPC peering with WorkOS.
- SSO, Directory Sync, and SCIM traffic may be routed through private networks.
- This requirement affects AWS/GCP infra planning but does not impact application-level code.

---

# 11. Codex Implementation Requirements

Codex MUST:

1. Build all new backend components with containerisation in mind.  
2. Avoid monolithic expansion; treat each subsystem as scoped.  
3. Use environment-variable-driven deployment configuration.  
4. Keep logic stateless; move state to Redis/Mongo/S3.  
5. Prepare code for queue-driven tasks (SQS or Pub/Sub).  
6. Implement health endpoints for service orchestration.  
7. Follow all audit, notification, and permission frameworks already defined.  
8. Make no assumptions that Render will always exist.  
9. Build features with horizontal scalability in mind.  
10. Use a clean interface for separating service boundaries (API contracts).  
11. Ensure logs are structured and machine-readable.  

---

# 12. Summary

This migration roadmap ensures Agama evolves from an MVP architecture into a **robust, scalable, secure enterprise-grade platform** with:

- Containerised workloads  
- Real-time collaboration at scale  
- Queue-driven integration processing  
- Enterprise security posture  
- Multi-region redundancy  
- Full auditability  
- AI-ready infrastructure  
- Enterprise networking and private connectivity  

Agama’s architecture is designed to grow into an enterprise product without rework — this document defines the path to get there.

---

**End of future_migration.md**
