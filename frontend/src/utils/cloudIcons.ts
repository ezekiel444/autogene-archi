/**
 * Cloud service SVG icons — one visually-distinct icon per service.
 *
 * Design rules:
 *  - viewBox 0 0 24 24, stroke-only, stroke-width 1.5, stroke-linecap/join round.
 *  - AWS    → #FF9900  Azure → #0078D4  GCP → #4285F4  Generic → #64748b
 *  - Each service has a UNIQUE shape so services within a platform are
 *    visually distinguishable — no two entries share the same drawing.
 *  - Service-category vocabulary (for consistency across platforms):
 *      Compute/VM      → chip/motherboard rect with pins
 *      Serverless/Fn   → lightning bolt
 *      Container       → cube/box
 *      Kubernetes      → helm-wheel (circle + 3 spokes + outer ring)
 *      Managed app     → layered-pages
 *      Object Storage  → bucket (open cylinder, flat top)
 *      Block Storage   → stacked rectangles
 *      File Share      → folded-page
 *      SQL DB          → multi-ring cylinder (3 ellipses + side)
 *      NoSQL DB        → grid/table shape
 *      Data Warehouse  → bar-chart inside rect
 *      Cache/Redis     → lightning inside cylinder
 *      CDN             → globe with equator + meridian
 *      DNS             → globe with 3 lat-lines
 *      Load Balancer   → tree/branch
 *      VPC/VNet        → dashed rect with inner nodes
 *      API Gateway     → rect with chevrons inside
 *      Queue           → four stacked rows
 *      Pub/Sub         → hub-and-spokes circle
 *      Event Bus       → triple-event line
 *      Stream          → wave lines
 *      IAM/Identity    → id card
 *      Auth            → padlock
 *      Key/KMS         → key
 *      Shield/WAF      → shield shape
 *      Monitoring      → chart with polyline
 *      Logs            → document with lines
 *      Metrics         → bar chart
 *      Tracing         → connected dots
 *      Audit           → clipboard
 *      Workflow        → diamond-chain
 *      ML/AI           → neural-net
 *      Search          → magnifier
 *      Analytics       → pie chart
 *      User            → person
 *      Browser         → browser window
 *      Mobile          → phone
 *      IoT             → device-with-antenna
 *      Email           → envelope
 *      Router          → network-T
 *      VPN             → two-boxes-with-bridge
 *      Proxy           → split-arrow
 *      Firewall        → grid-wall
 *      Cloud           → cloud silhouette
 *      Server          → rack unit
 *      Docker          → whale
 *      Kafka           → multi-circle cluster
 *      Nginx           → N with line
 *      Postgres/MySQL  → distinct elephant / dolphin badge
 *      MongoDB         → leaf shape
 *      Redis           → R-flash
 *      Elasticsearch   → magnifier-E badge
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const S = (color: string, body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const AWS = '#FF9900';
const AZ  = '#0078D4';
const GCP = '#4285F4';
const G   = '#64748b';

// ─── Shape library (each function produces a unique drawing) ─────────────────

// Compute: VM / EC2 / Compute Engine — motherboard rect with corner pins
const shapeVM = (c: string) => S(c,
  '<rect x="4" y="6" width="16" height="12" rx="1"/>' +
  '<rect x="7" y="9" width="10" height="6" rx="1"/>' +
  '<path d="M7 6V4M12 6V3M17 6V4M7 18v2M12 18v3M17 18v2"/>');

// Serverless / Lambda / Functions — lightning bolt
const shapeFn = (c: string) => S(c,
  '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>');

// Container / ECS / ACI — cube with dotted back-face
const shapeCube = (c: string) => S(c,
  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>' +
  '<path d="M12 3v18M4 7.5l8 4.5 8-4.5" stroke-dasharray="2 1.5"/>');

// Kubernetes / EKS / AKS / GKE — helm wheel
const shapeK8s = (c: string) => S(c,
  '<circle cx="12" cy="12" r="9"/>' +
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>');

// Fargate / Cloud Run / Container Instances — rocket / lift-off shape
const shapeRocket = (c: string) => S(c,
  '<path d="M12 2c4 4 4 10 0 16-4-6-4-12 0-16z"/>' +
  '<path d="M7 14c-2 1-3 3-3 5h2M17 14c2 1 3 3 3 5h-2"/>' +
  '<circle cx="12" cy="10" r="1.5" fill="currentColor"/>');

// App Service / App Engine — layered pages
const shapeAppService = (c: string) => S(c,
  '<rect x="5" y="7" width="14" height="11" rx="1"/>' +
  '<path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>' +
  '<path d="M8 11h8M8 14h5"/>');

// Object Storage (S3 / Blob / GCS) — bucket
const shapeBucket = (c: string) => S(c,
  '<path d="M6 8h12l-1.5 11H7.5L6 8z"/>' +
  '<path d="M4 8h16"/>' +
  '<path d="M9 8V6a3 3 0 0 1 6 0v2"/>');

// Block Storage (EBS) — stacked rectangles
const shapeBlockVol = (c: string) => S(c,
  '<rect x="4" y="4" width="16" height="4" rx="1"/>' +
  '<rect x="4" y="10" width="16" height="4" rx="1"/>' +
  '<rect x="4" y="16" width="16" height="4" rx="1"/>');

// File Share (EFS / Azure Files) — folder-page with lines
const shapeFileShare = (c: string) => S(c,
  '<path d="M4 5h7l2 2h7v12H4z"/>' +
  '<path d="M8 13h8M8 16h5"/>');

// Relational DB / RDS / SQL — triple-ring cylinder
const shapeSQLDB = (c: string) => S(c,
  '<ellipse cx="12" cy="6" rx="7" ry="2.5"/>' +
  '<ellipse cx="12" cy="12" rx="7" ry="2.5"/>' +
  '<ellipse cx="12" cy="18" rx="7" ry="2.5"/>' +
  '<path d="M5 6v12M19 6v12"/>');

// Aurora — cylinder with lightning inside (high-perf DB)
const shapeAurora = (c: string) => S(c,
  '<ellipse cx="12" cy="6" rx="7" ry="2.5"/>' +
  '<path d="M5 6v12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6"/>' +
  '<path d="M12 9l-2 4h4l-2 4"/>');

// NoSQL / DynamoDB / Cosmos DB / Bigtable — grid table
const shapeNoSQL = (c: string) => S(c,
  '<rect x="3" y="5" width="18" height="14" rx="1"/>' +
  '<path d="M3 9h18M3 13h18M9 5v14M15 5v14"/>');

// Data Warehouse / Redshift / Synapse / BigQuery — bar chart inside rect
const shapeWarehouse = (c: string) => S(c,
  '<rect x="3" y="3" width="18" height="18" rx="1"/>' +
  '<path d="M7 17V11M12 17V8M17 17V13"/>');

// Cache / ElastiCache — lightning inside a rounded rect
const shapeCache = (c: string) => S(c,
  '<rect x="3" y="5" width="18" height="14" rx="3"/>' +
  '<path d="M12 8l-3 4h6l-3 4"/>');

// CDN — globe with equator + single meridian
const shapeCDN = (c: string) => S(c,
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M3 12h18"/>' +
  '<ellipse cx="12" cy="12" rx="5" ry="9"/>');

// DNS — globe with three latitude lines
const shapeDNS = (c: string) => S(c,
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M3 9h18M3 15h18"/>' +
  '<path d="M12 3a18 18 0 0 1 0 18M12 3a18 18 0 0 0 0 18"/>');

// Load Balancer / ELB — tree branch
const shapeLB = (c: string) => S(c,
  '<circle cx="12" cy="5" r="2.5"/>' +
  '<circle cx="5" cy="19" r="2.5"/>' +
  '<circle cx="19" cy="19" r="2.5"/>' +
  '<path d="M12 7.5v4M12 11.5l-5 5M12 11.5l5 5"/>');

// VPC / VNet — dashed boundary rect with two inner nodes connected
const shapeVPC = (c: string) => S(c,
  '<rect x="2" y="4" width="20" height="16" rx="2" stroke-dasharray="4 2"/>' +
  '<circle cx="8" cy="12" r="2.5"/>' +
  '<circle cx="16" cy="12" r="2.5"/>' +
  '<path d="M10.5 12h3"/>');

// API Gateway — rect with left-in/right-out chevrons
const shapeGateway = (c: string) => S(c,
  '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
  '<path d="M8 9l-2 3 2 3M16 9l2 3-2 3"/>' +
  '<path d="M11 12h2"/>');

// Route 53 / Traffic Manager / Cloud DNS — radar target
const shapeRoute53 = (c: string) => S(c,
  '<circle cx="12" cy="12" r="9"/>' +
  '<circle cx="12" cy="12" r="5"/>' +
  '<circle cx="12" cy="12" r="1.5" fill="currentColor"/>');

// SQS / Queue / Service Bus — four stacked rows (queue slots)
const shapeQueue = (c: string) => S(c,
  '<rect x="3" y="4" width="18" height="3" rx="1"/>' +
  '<rect x="3" y="9" width="18" height="3" rx="1"/>' +
  '<rect x="3" y="14" width="18" height="3" rx="1"/>' +
  '<path d="M21 5h2M21 10h2M21 15h2"/>');

// SNS / Pub-Sub / Service Bus Topic — star burst / hub spokes
const shapePubSub = (c: string) => S(c,
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/>');

// EventBridge / Event Grid / Eventarc — three event nodes on a horizontal bus
const shapeEventBus = (c: string) => S(c,
  '<path d="M3 12h18"/>' +
  '<circle cx="7" cy="12" r="2"/>' +
  '<circle cx="12" cy="12" r="2"/>' +
  '<circle cx="17" cy="12" r="2"/>' +
  '<path d="M7 8v2M12 6v4M17 8v2"/>');

// Kinesis / Event Hub / Dataflow — horizontal wave lines
const shapeStream = (c: string) => S(c,
  '<path d="M3 8c3-2 6 2 9 0s6-2 9-2"/>' +
  '<path d="M3 12c3-2 6 2 9 0s6-2 9-2"/>' +
  '<path d="M3 16c3-2 6 2 9 0s6-2 9-2"/>');

// Step Functions / Logic Apps — diamond chain / workflow
const shapeWorkflow = (c: string) => S(c,
  '<rect x="9" y="2" width="6" height="6" rx="1" transform="rotate(45 12 5)"/>' +
  '<rect x="9" y="10" width="6" height="6" rx="1" transform="rotate(45 12 13)"/>' +
  '<path d="M12 8v4"/>');

// IAM / AAD / GCP IAM — ID card
const shapeIAM = (c: string) => S(c,
  '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
  '<circle cx="8" cy="12" r="2.5"/>' +
  '<path d="M13 10h5M13 13h5M5 19v-2"/>');

// Cognito / App Insights for auth — padlock with user above
const shapeAuth = (c: string) => S(c,
  '<rect x="7" y="11" width="10" height="8" rx="2"/>' +
  '<path d="M9 11V8a3 3 0 0 1 6 0v3"/>' +
  '<circle cx="12" cy="15.5" r="1.2"/>');

// KMS / Key Vault / Secret Manager — key (bow + blade)
const shapeKey = (c: string) => S(c,
  '<circle cx="7.5" cy="13.5" r="3.5"/>' +
  '<path d="M10.5 10.5L20 4M16 6l3 3M14 8l3 3"/>');

// WAF / Shield / Cloud Armor — shield with check
const shapeShield = (c: string) => S(c,
  '<path d="M12 2L4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4z"/>' +
  '<path d="M9 12l2 2 4-4"/>');

// CloudWatch / Monitor / Cloud Monitoring — chart with polyline spike
const shapeMonitoring = (c: string) => S(c,
  '<rect x="2" y="4" width="20" height="14" rx="2"/>' +
  '<path d="M5 14l3-4 3 5 3-7 3 3"/>' +
  '<path d="M2 18h20"/>');

// CloudTrail / Audit — clipboard with check mark
const shapeAudit = (c: string) => S(c,
  '<path d="M9 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/>' +
  '<path d="M9 3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V3z"/>' +
  '<path d="M9 12l2 2 4-4"/>');

// X-Ray / Tracing — dotted path between nodes
const shapeTracing = (c: string) => S(c,
  '<circle cx="5" cy="7" r="2"/>' +
  '<circle cx="12" cy="17" r="2"/>' +
  '<circle cx="19" cy="7" r="2"/>' +
  '<path d="M6.7 8.7l3.6 6.6M12 15v-2M17.3 8.7l-3.6 6.6" stroke-dasharray="3 1.5"/>');

// CloudWatch Logs / Azure Logs / Cloud Logging — document with lines
const shapeLogs = (c: string) => S(c,
  '<path d="M6 3h12l3 3v15H3V3h3z"/>' +
  '<path d="M15 3v4h4"/>' +
  '<path d="M8 10h8M8 13h8M8 16h5"/>');

// Metrics — bar chart (standalone)
const shapeMetrics = (c: string) => S(c,
  '<path d="M6 20V12M12 20V6M18 20V14"/>' +
  '<path d="M3 20h18"/>');

// SageMaker / Vertex AI / Azure ML — neural net
const shapeML = (c: string) => S(c,
  '<circle cx="4" cy="7" r="2"/>' +
  '<circle cx="4" cy="17" r="2"/>' +
  '<circle cx="12" cy="5" r="2"/>' +
  '<circle cx="12" cy="12" r="2"/>' +
  '<circle cx="12" cy="19" r="2"/>' +
  '<circle cx="20" cy="12" r="2"/>' +
  '<path d="M6 7.5l4 3M6 16.5l4-2.5M6 8.5l4 7M14 12h4M14 5.5l4 5.5M14 18.5l4-5.5"/>');

// Firestore / DocumentDB — document stack
const shapeFirestore = (c: string) => S(c,
  '<path d="M5 6h14v14H5z"/>' +
  '<path d="M9 3h10v14"/>' +
  '<path d="M8 10h7M8 13h5"/>');

// Spanner / Azure Synapse — globe with gear overlay (global distributed)
const shapeSpanner = (c: string) => S(c,
  '<circle cx="12" cy="12" r="8"/>' +
  '<path d="M12 4v16M4 12h16"/>' +
  '<circle cx="12" cy="12" r="3"/>');

// Memorystore / Azure Redis — lightning in pill
const shapeMemory = (c: string) => S(c,
  '<rect x="3" y="7" width="18" height="10" rx="5"/>' +
  '<path d="M12 9l-2 3h4l-2 3"/>');

// Front Door / Global LB — broadcast / signal
const shapeFrontDoor = (c: string) => S(c,
  '<path d="M4.9 4.9a10 10 0 0 0 0 14.2"/>' +
  '<path d="M19.1 4.9a10 10 0 0 1 0 14.2"/>' +
  '<path d="M7.8 7.8a6 6 0 0 0 0 8.4"/>' +
  '<path d="M16.2 7.8a6 6 0 0 1 0 8.4"/>' +
  '<circle cx="12" cy="12" r="1.5"/>');

// Traffic Manager — split traffic arrows
const shapeTrafficMgr = (c: string) => S(c,
  '<circle cx="12" cy="6" r="2.5"/>' +
  '<path d="M12 8.5v4"/>' +
  '<path d="M8 16.5l4-4 4 4"/>' +
  '<circle cx="7" cy="18.5" r="2"/>' +
  '<circle cx="17" cy="18.5" r="2"/>');

// Service Bus (Azure) — envelope on queue
const shapeServiceBus = (c: string) => S(c,
  '<rect x="3" y="8" width="18" height="12" rx="2"/>' +
  '<path d="M3 10l9 6 9-6"/>' +
  '<path d="M8 8V6a4 4 0 0 1 8 0v2"/>');

// Event Hub (Azure) — telescope / event horizon
const shapeEventHub = (c: string) => S(c,
  '<path d="M3 12h3M6 12l3-5M6 12l3 5M9 7h6M9 17h6M15 7l3 5M15 17l3-5M18 12h3"/>');

// Azure Storage (account) — filing cabinet
const shapeStorageAccount = (c: string) => S(c,
  '<rect x="4" y="3" width="16" height="18" rx="1"/>' +
  '<path d="M8 8h8M8 12h8M8 16h5"/>' +
  '<path d="M4 7h16"/>');

// Cloud Functions (generic) — bolt inside square (differentiate from Lambda)
const shapeFnSquare = (c: string) => S(c,
  '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
  '<path d="M12 7l-3 5h6l-3 5"/>');

// Microservice — hexagon
const shapeMicroservice = (c: string) => S(c,
  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>');

// Web server — browser-like rectangle with address bar
const shapeWebServer = (c: string) => S(c,
  '<rect x="3" y="5" width="18" height="15" rx="2"/>' +
  '<path d="M3 10h18"/>' +
  '<circle cx="6" cy="7.5" r=".8" fill="currentColor"/>' +
  '<circle cx="9" cy="7.5" r=".8" fill="currentColor"/>');

// API (REST label) — bracket-arrow
const shapeAPI = (c: string) => S(c,
  '<path d="M8 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>' +
  '<path d="M16 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3"/>' +
  '<path d="M10 12l2-2 2 2M12 10v4"/>');

// Generic database / Cassandra fallback — single-ring cylinder
const shapeDB = (c: string) => S(c,
  '<ellipse cx="12" cy="6" rx="8" ry="3"/>' +
  '<path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/>');

// Object storage (generic, different from bucket) — hexagonal prism
const shapeObjStorage = (c: string) => S(c,
  '<path d="M12 3l7 4v10l-7 4-7-4V7z"/>' +
  '<path d="M5 7l7 4 7-4M12 11v10"/>');

// Router — network T with dots
const shapeRouter = (c: string) => S(c,
  '<rect x="3" y="15" width="18" height="5" rx="1"/>' +
  '<path d="M7 18h.01M10 18h.01"/>' +
  '<path d="M12 15v-5M6 10H3M18 10h3M6 5V3M12 5V3M18 5V3"/>' +
  '<path d="M6 10l-3-5M18 10l3-5M12 10V5"/>');

// VPN — tunnel
const shapeVPN = (c: string) => S(c,
  '<rect x="2" y="9" width="7" height="6" rx="1"/>' +
  '<rect x="15" y="9" width="7" height="6" rx="1"/>' +
  '<path d="M9 12h6" stroke-dasharray="2 1.5"/>' +
  '<path d="M10 11l-1 1 1 1M14 11l1 1-1 1"/>');

// Proxy / Reverse proxy — two arrows crossing
const shapeProxy = (c: string) => S(c,
  '<path d="M3 8l5 4-5 4"/>' +
  '<path d="M21 8l-5 4 5 4"/>' +
  '<path d="M8 12h8"/>');

// Firewall — brick wall
const shapeFirewall = (c: string) => S(c,
  '<rect x="3" y="4" width="18" height="16" rx="1"/>' +
  '<path d="M3 9h18M3 14h18M8 4v5M14 4v5M6 14v6M12 14v6M18 14v6"/>');

// User — person silhouette
const shapeUser = (c: string) => S(c,
  '<circle cx="12" cy="8" r="4"/>' +
  '<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>');

// Mobile — phone outline
const shapeMobile = (c: string) => S(c,
  '<rect x="7" y="2" width="10" height="20" rx="3"/>' +
  '<path d="M10 18h4"/>');

// Browser — window with tabs
const shapeBrowser = (c: string) => S(c,
  '<rect x="2" y="5" width="20" height="16" rx="2"/>' +
  '<path d="M2 10h20"/>' +
  '<circle cx="5.5" cy="7.5" r=".8" fill="currentColor"/>' +
  '<circle cx="8.5" cy="7.5" r=".8" fill="currentColor"/>');

// IoT — device with signal arc
const shapeIoT = (c: string) => S(c,
  '<rect x="7" y="13" width="10" height="8" rx="1"/>' +
  '<path d="M9 21v-2M12 21v-3M15 21v-2"/>' +
  '<path d="M9 10a4 4 0 0 1 6 0"/>' +
  '<path d="M6 7a8 8 0 0 1 12 0"/>');

// Email — envelope with flap
const shapeEmail = (c: string) => S(c,
  '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
  '<path d="M3 8l9 6 9-6"/>');

// Generic cloud — cloud silhouette
const shapeCloud = (c: string) => S(c,
  '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>');

// Server rack unit — rect with indicators
const shapeServer = (c: string) => S(c,
  '<rect x="3" y="4" width="18" height="6" rx="1"/>' +
  '<rect x="3" y="13" width="18" height="6" rx="1"/>' +
  '<circle cx="7" cy="7" r=".8" fill="currentColor"/>' +
  '<circle cx="7" cy="16" r=".8" fill="currentColor"/>' +
  '<path d="M10 7h8M10 16h8"/>');

// Docker — whale silhouette
const shapeDocker = (c: string) => S(c,
  '<path d="M13 4h2v3h-2zM10 4h2v3h-2zM7 4h2v3H7zM7 7h2v3H7zM10 7h2v3h-2zM13 7h2v3h-2zM16 7h2v3h-2z"/>' +
  '<path d="M2 12c1 0 2 .6 2.5 1.5C6 12 8 11 10 12H21.5S21 9 18 9h-1V7"/>' +
  '<path d="M4.5 13.5c-.5 1.5-1 3 0 4.5 2 1 11 1 13 0 1.5-1.5 1-6 1-6"/>');

// Kubernetes (generic, same wheel but no brand color)
const shapeKubernetes = () => S('#326CE5',
  '<circle cx="12" cy="12" r="9"/>' +
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>');

// Redis — lightning-R badge
const shapeRedis = () => S('#dc2626',
  '<rect x="3" y="3" width="18" height="18" rx="3"/>' +
  '<path d="M8 16V8h5a3 3 0 0 1 0 5H8M13 13l4 3"/>');

// Kafka — cluster of nodes
const shapeKafka = () => S('#231F20',
  '<circle cx="6" cy="5" r="2"/>' +
  '<circle cx="6" cy="19" r="2"/>' +
  '<circle cx="18" cy="12" r="2"/>' +
  '<circle cx="12" cy="9" r="2"/>' +
  '<circle cx="12" cy="15" r="2"/>' +
  '<path d="M7.8 6.2l2.6 1.6M7.8 17.8l2.6-1.6M14 9.8l2.4 1.2M14 14.2l2.4-1.2"/>');

// Nginx — stylised N
const shapeNginx = () => S('#009639',
  '<path d="M5 19V5l14 14V5" stroke-width="2.5"/>');

// PostgreSQL — elephant silhouette
const shapePostgres = () => S('#336791',
  '<path d="M12 3c-5 0-8 3-8 7 0 3 1.5 5.5 4 7v4h2v-3h4v3h2v-4c2.5-1.5 4-4 4-7 0-4-3-7-8-7z"/>' +
  '<circle cx="9" cy="9" r="1.5"/>' +
  '<circle cx="15" cy="9" r="1.5"/>');

// MySQL — dolphin fin
const shapeMySQL = () => S('#00758F',
  '<path d="M12 3c-4 0-7 3-7 7s3 9 7 11c4-2 7-7 7-11s-3-7-7-7z"/>' +
  '<path d="M9 11c0-3 6-5 6-2s-6 5-6 2z"/>');

// MongoDB — leaf
const shapeMongoDB = () => S('#13aa52',
  '<path d="M12 2v20"/>' +
  '<path d="M12 2C8 7 6 12 12 22c6-10 4-15 0-20z"/>');

// Elasticsearch — magnifier with E grid
const shapeES = () => S('#005571',
  '<circle cx="11" cy="10" r="7"/>' +
  '<path d="M21 21l-4-4"/>' +
  '<path d="M8 8h6M8 10.5h5M8 13h6"/>');

// Monitoring generic — same as shapeMonitoring but with G color
const shapeMonGen = () => S(G,
  '<rect x="2" y="4" width="20" height="14" rx="2"/>' +
  '<path d="M5 14l3-4 3 5 3-7 3 3"/>' +
  '<path d="M2 18h20"/>');

// Analytics — pie chart slice
const shapeAnalytics = (c: string) => S(c,
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M12 3v9l7 3.5"/>' +
  '<path d="M12 12L5 16"/>');

// AI — brain outline
const shapeAI = (c: string) => S(c,
  '<path d="M9.5 3A6.5 6.5 0 0 0 3 9.5c0 2.5 1.4 4.7 3.4 5.9V18h2v2h7v-2h2v-2.6c2-1.2 3.4-3.4 3.4-5.9A6.5 6.5 0 0 0 14.5 3C13.6 3 13 3.6 13 4.5v1a1 1 0 0 1-2 0v-1C11 3.6 10.4 3 9.5 3z"/>' +
  '<path d="M9 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2M13 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>');

// Default fallback
const shapeDef = (c: string) => S(c,
  '<rect x="3" y="3" width="18" height="18" rx="3"/>' +
  '<circle cx="12" cy="12" r="4"/>');

// ─── Message Broker (generic) ─────────────────────────────────────────────────
const shapeMsgBroker = (c: string) => S(c,
  '<rect x="3" y="6" width="18" height="12" rx="2"/>' +
  '<path d="M7 10h4M7 14h6"/>' +
  '<path d="M15 10l2 2-2 2"/>');

// GCP Secret Manager — vault door (cylinder with combination dial)
const shapeSecretMgr = (c: string) => S(c,
  '<ellipse cx="12" cy="7" rx="7" ry="2.5"/>' +
  '<path d="M5 7v10c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V7"/>' +
  '<circle cx="12" cy="12" r="2"/>' +
  '<path d="M12 10v-1M12 15v-1M10 12H9M15 12h-1"/>');

// Azure Event Grid — branching event fan
const shapeEventGrid = (c: string) => S(c,
  '<circle cx="5" cy="12" r="2"/>' +
  '<circle cx="19" cy="6" r="2"/>' +
  '<circle cx="19" cy="12" r="2"/>' +
  '<circle cx="19" cy="18" r="2"/>' +
  '<path d="M7 12h4M11 12l5-6M11 12h1M11 12l5 6"/>');


const shapeCloudSQL = (c: string) => S(c,
  '<ellipse cx="12" cy="6" rx="7" ry="2.5"/>' +
  '<path d="M5 6v12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6"/>' +
  '<path d="M9 12h6M12 9v6"/>');

// ─── GCP Bigtable — wide-column (horizontal slabs) ───────────────────────────
const shapeBigtable = (c: string) => S(c,
  '<rect x="3" y="4" width="18" height="4" rx="1"/>' +
  '<rect x="3" y="10" width="12" height="4" rx="1"/>' +
  '<rect x="3" y="16" width="8" height="4" rx="1"/>');

// ─── GCP Dataflow — pipeline/funnel ──────────────────────────────────────────
const shapeDataflow = (c: string) => S(c,
  '<path d="M3 5h18l-7 7v7l-4-2v-5L3 5z"/>');

// ─── GCP Cloud Armor / WAF ── shield + wall lines ────────────────────────────
const shapeArmor = (c: string) => S(c,
  '<path d="M12 2L4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4z"/>' +
  '<path d="M8 12h8M8 15h5"/>');

// ─── AWS Step Functions — state-machine circles + connecting arrows ───────────
const shapeStepFn = (c: string) => S(c,
  '<circle cx="12" cy="4" r="2.5"/>' +
  '<circle cx="4" cy="15" r="2.5"/>' +
  '<circle cx="20" cy="15" r="2.5"/>' +
  '<path d="M11 6l-5 7M13 6l5 7M6.5 15.5l5 .5M17.5 15.5l-5 .5"/>');

// ─── AWS Fargate / GCP Cloud Run (overrides rocket for Fargate) ──────────────
const shapeFargate = (c: string) => S(c,
  '<rect x="6" y="4" width="12" height="14" rx="2"/>' +
  '<path d="M9 4V2M15 4V2"/>' +
  '<path d="M9 18v2M15 18v2"/>' +
  '<path d="M6 9h12"/>');

// ─── Azure App Service (distinct from generic managed app) ───────────────────
const shapeAzureApp = (c: string) => S(c,
  '<rect x="4" y="4" width="16" height="16" rx="2"/>' +
  '<path d="M8 4v4h8V4"/>' +
  '<path d="M8 12h8M8 15h5"/>' +
  '<path d="M4 8h16"/>');

// ─── Azure Blob (distinct from Storage Account) ──────────────────────────────
const shapeBlob = (c: string) => S(c,
  '<path d="M12 3C7 3 3 6 3 10s1 6 3 7v4h12v-4c2-1 3-3 3-7 0-4-4-7-9-7z"/>');

// ─── Azure Container Instances (distinct from Cube) ──────────────────────────
const shapeACI = (c: string) => S(c,
  '<rect x="4" y="8" width="7" height="7" rx="1"/>' +
  '<rect x="13" y="8" width="7" height="7" rx="1"/>' +
  '<path d="M7.5 4h9a1 1 0 0 1 1 1v3H6.5V5a1 1 0 0 1 1-1z"/>' +
  '<path d="M8 19v2M16 19v2"/>');

// ─── Azure PostgreSQL ─────────────────────────────────────────────────────────
const shapeAzurePG = (c: string) => S(c,
  '<ellipse cx="12" cy="6" rx="7" ry="2.5"/>' +
  '<path d="M5 6v12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6"/>' +
  '<path d="M8 12l4-4 4 4"/>');

// ─── Azure API Management ─────────────────────────────────────────────────────
const shapeAPIMgmt = (c: string) => S(c,
  '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
  '<path d="M7 9h10M7 12h7M7 15h4"/>' +
  '<path d="M18 12l2-2-2-2"/>');

// ─── GCP App Engine (layered pages with GCP color) ───────────────────────────
const shapeAppEngine = (c: string) => S(c,
  '<rect x="4" y="8" width="16" height="11" rx="1"/>' +
  '<path d="M7 8V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2"/>' +
  '<path d="M7 5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2"/>' +
  '<path d="M8 13h8M8 16h5"/>');

// ─── Registry ────────────────────────────────────────────────────────────────

const CLOUD_ICONS: Record<string, string> = {
  // ── AWS ──────────────────────────────────────────────────────────────────
  'aws-lambda':        shapeFn(AWS),
  'aws-ec2':           shapeVM(AWS),
  'aws-ecs':           shapeCube(AWS),
  'aws-eks':           shapeK8s(AWS),
  'aws-fargate':       shapeFargate(AWS),
  'aws-s3':            shapeBucket(AWS),
  'aws-ebs':           shapeBlockVol(AWS),
  'aws-efs':           shapeFileShare(AWS),
  'aws-rds':           shapeSQLDB(AWS),
  'aws-aurora':        shapeAurora(AWS),
  'aws-dynamodb':      shapeNoSQL(AWS),
  'aws-redshift':      shapeWarehouse(AWS),
  'aws-elasticache':   shapeCache(AWS),
  'aws-vpc':           shapeVPC(AWS),
  'aws-route53':       shapeRoute53(AWS),
  'aws-cloudfront':    shapeCDN(AWS),
  'aws-elb':           shapeLB(AWS),
  'aws-api-gateway':   shapeGateway(AWS),
  'aws-sqs':           shapeQueue(AWS),
  'aws-sns':           shapePubSub(AWS),
  'aws-eventbridge':   shapeEventBus(AWS),
  'aws-kinesis':       shapeStream(AWS),
  'aws-iam':           shapeIAM(AWS),
  'aws-cognito':       shapeAuth(AWS),
  'aws-kms':           shapeKey(AWS),
  'aws-waf':           shapeShield(AWS),
  'aws-cloudwatch':    shapeMonitoring(AWS),
  'aws-cloudtrail':    shapeAudit(AWS),
  'aws-x-ray':         shapeTracing(AWS),
  'aws-step-functions': shapeStepFn(AWS),
  'aws-sagemaker':     shapeML(AWS),
  aws:                 shapeCloud(AWS),

  // ── Azure ─────────────────────────────────────────────────────────────────
  'azure-functions':         shapeFnSquare(AZ),
  'azure-vm':                shapeVM(AZ),
  'azure-aks':               shapeK8s(AZ),
  'azure-app-service':       shapeAzureApp(AZ),
  'azure-container-instances': shapeACI(AZ),
  'azure-storage':           shapeStorageAccount(AZ),
  'azure-blob':              shapeBlob(AZ),
  'azure-sql':               shapeSQLDB(AZ),
  'azure-cosmos-db':         shapeNoSQL(AZ),
  'azure-postgresql':        shapeAzurePG(AZ),
  'azure-redis':             shapeMemory(AZ),
  'azure-virtual-network':   shapeVPC(AZ),
  'azure-load-balancer':     shapeLB(AZ),
  'azure-cdn':               shapeCDN(AZ),
  'azure-front-door':        shapeFrontDoor(AZ),
  'azure-traffic-manager':   shapeTrafficMgr(AZ),
  'azure-service-bus':       shapeServiceBus(AZ),
  'azure-event-hub':         shapeEventHub(AZ),
  'azure-event-grid':        shapeEventGrid(AZ),
  'azure-active-directory':  shapeIAM(AZ),
  'azure-key-vault':         shapeKey(AZ),
  'azure-monitor':           shapeMonitoring(AZ),
  'azure-app-insights':      shapeTracing(AZ),
  'azure-logic-apps':        shapeWorkflow(AZ),
  'azure-api-management':    shapeAPIMgmt(AZ),
  'azure-synapse':           shapeWarehouse(AZ),
  'azure-ml':                shapeML(AZ),
  azure:                     shapeCloud(AZ),

  // ── GCP ──────────────────────────────────────────────────────────────────
  'gcp-cloud-functions':     shapeFn(GCP),
  'gcp-compute-engine':      shapeVM(GCP),
  'gcp-gke':                 shapeK8s(GCP),
  'gcp-cloud-run':           shapeFargate(GCP),
  'gcp-app-engine':          shapeAppEngine(GCP),
  'gcp-cloud-storage':       shapeBucket(GCP),
  'gcp-cloud-sql':           shapeCloudSQL(GCP),
  'gcp-bigtable':            shapeBigtable(GCP),
  'gcp-firestore':           shapeFirestore(GCP),
  'gcp-spanner':             shapeSpanner(GCP),
  'gcp-memorystore':         shapeMemory(GCP),
  'gcp-vpc':                 shapeVPC(GCP),
  'gcp-cloud-load-balancing': shapeLB(GCP),
  'gcp-cloud-cdn':           shapeCDN(GCP),
  'gcp-cloud-dns':           shapeDNS(GCP),
  'gcp-cloud-armor':         shapeArmor(GCP),
  'gcp-pubsub':              shapePubSub(GCP),
  'gcp-eventarc':            shapeEventBus(GCP),
  'gcp-iam':                 shapeIAM(GCP),
  'gcp-kms':                 shapeKey(GCP),
  'gcp-secret-manager':      shapeSecretMgr(GCP),
  'gcp-cloud-monitoring':    shapeMonitoring(GCP),
  'gcp-cloud-logging':       shapeLogs(GCP),
  'gcp-bigquery':            shapeWarehouse(GCP),
  'gcp-dataflow':            shapeDataflow(GCP),
  'gcp-vertex-ai':           shapeML(GCP),
  gcp:                       shapeCloud(GCP),

  // ── Generic / cloud-agnostic ─────────────────────────────────────────────
  server:           shapeServer(G),
  microservice:     shapeMicroservice(G),
  container:        shapeCube(G),
  function:         shapeFn(G),
  'web-server':     shapeWebServer(G),
  api:              shapeAPI(G),
  gateway:          shapeGateway(G),
  database:         shapeDB(G),
  nosql:            shapeNoSQL(G),
  'data-warehouse': shapeWarehouse(G),
  'object-storage': shapeObjStorage(G),
  router:           shapeRouter(G),
  dns:              shapeDNS(G),
  vpn:              shapeVPN(G),
  'load-balancer':  shapeLB(G),
  firewall:         shapeFirewall(G),
  cdn:              shapeCDN(G),
  proxy:            shapeProxy(G),
  queue:            shapeQueue(G),
  'message-broker': shapeMsgBroker(G),
  'event-bus':      shapeEventBus(G),
  auth:             shapeAuth(G),
  key:              shapeKey(G),
  shield:           shapeShield(G),
  monitoring:       shapeMonGen(),
  logs:             shapeLogs(G),
  metrics:          shapeMetrics(G),
  user:             shapeUser(G),
  mobile:           shapeMobile(G),
  browser:          shapeBrowser(G),
  iot:              shapeIoT(G),
  kubernetes:       shapeKubernetes(),
  docker:           shapeDocker(G),
  redis:            shapeRedis(),
  kafka:            shapeKafka(),
  nginx:            shapeNginx(),
  postgres:         shapePostgres(),
  mysql:            shapeMySQL(),
  mongodb:          shapeMongoDB(),
  elasticsearch:    shapeES(),
  cloud:            shapeCloud(G),
  cache:            shapeCache(G),
  analytics:        shapeAnalytics(G),
  ai:               shapeAI(G),
  email:            shapeEmail(G),
  default:          shapeDef(G),
};

/**
 * Returns the SVG string for a given cloud icon name.
 * Falls back to the default icon if name is not found.
 */
export function getCloudIcon(iconName: string): string {
  return CLOUD_ICONS[iconName] || CLOUD_ICONS['default'];
}

/**
 * Returns the list of all icon names recognized by the renderer.
 * Used by the icon-catalog drift test.
 */
export function getRegisteredIconNames(): string[] {
  return Object.keys(CLOUD_ICONS);
}
