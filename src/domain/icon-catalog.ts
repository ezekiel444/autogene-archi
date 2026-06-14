/**
 * Icon catalog — single source of truth for diagram icon names.
 *
 * The backend uses this list to instruct the AI, the frontend renders one
 * SVG per name in `frontend/src/utils/cloudIcons.ts`. A unit test asserts
 * the two stay in sync; do not add an entry here without adding the matching
 * SVG on the frontend.
 */

export type IconPlatform = 'aws' | 'azure' | 'gcp' | 'generic';

export interface IconEntry {
  /** Stable name; this is what the AI emits in the diagram JSON. */
  name: string;
  /** Short human description that appears in the AI prompt. */
  description: string;
}

export interface IconCategory {
  /** Category label, e.g. "Compute", "Storage". */
  category: string;
  icons: IconEntry[];
}

export interface IconPlatformGroup {
  platform: IconPlatform;
  /** Human-readable name shown in the prompt. */
  displayName: string;
  /** Hex color used by the frontend SVGs (kept here for reference). */
  brandColor: string;
  categories: IconCategory[];
}

// ─── AWS ─────────────────────────────────────────────────────────────────────

const AWS_ICONS: IconCategory[] = [
  {
    category: 'Compute',
    icons: [
      { name: 'aws-lambda', description: 'serverless function' },
      { name: 'aws-ec2', description: 'virtual machine instance' },
      { name: 'aws-ecs', description: 'container service' },
      { name: 'aws-eks', description: 'managed Kubernetes' },
      { name: 'aws-fargate', description: 'serverless containers' },
    ],
  },
  {
    category: 'Storage',
    icons: [
      { name: 'aws-s3', description: 'object storage' },
      { name: 'aws-ebs', description: 'block storage volume' },
      { name: 'aws-efs', description: 'shared file system' },
    ],
  },
  {
    category: 'Database',
    icons: [
      { name: 'aws-rds', description: 'managed relational DB' },
      { name: 'aws-aurora', description: 'managed MySQL/Postgres-compatible DB' },
      { name: 'aws-dynamodb', description: 'managed NoSQL DB' },
      { name: 'aws-redshift', description: 'data warehouse' },
      { name: 'aws-elasticache', description: 'in-memory cache (Redis/Memcached)' },
    ],
  },
  {
    category: 'Networking',
    icons: [
      { name: 'aws-vpc', description: 'virtual private cloud' },
      { name: 'aws-route53', description: 'DNS' },
      { name: 'aws-cloudfront', description: 'CDN' },
      { name: 'aws-elb', description: 'elastic load balancer' },
      { name: 'aws-api-gateway', description: 'managed API gateway' },
    ],
  },
  {
    category: 'Messaging & Streaming',
    icons: [
      { name: 'aws-sqs', description: 'managed queue' },
      { name: 'aws-sns', description: 'pub/sub topic' },
      { name: 'aws-eventbridge', description: 'event bus' },
      { name: 'aws-kinesis', description: 'streaming data' },
    ],
  },
  {
    category: 'Security & Identity',
    icons: [
      { name: 'aws-iam', description: 'identity and access management' },
      { name: 'aws-cognito', description: 'user authentication' },
      { name: 'aws-kms', description: 'key management service' },
      { name: 'aws-waf', description: 'web application firewall' },
    ],
  },
  {
    category: 'Observability',
    icons: [
      { name: 'aws-cloudwatch', description: 'metrics and logs' },
      { name: 'aws-cloudtrail', description: 'audit logging' },
      { name: 'aws-x-ray', description: 'distributed tracing' },
    ],
  },
  {
    category: 'Integration & ML',
    icons: [
      { name: 'aws-step-functions', description: 'workflow orchestration' },
      { name: 'aws-sagemaker', description: 'machine learning platform' },
    ],
  },
  {
    category: 'Generic AWS',
    icons: [{ name: 'aws', description: 'AWS service (use only if no specific icon fits)' }],
  },
];

// ─── Azure ───────────────────────────────────────────────────────────────────

const AZURE_ICONS: IconCategory[] = [
  {
    category: 'Compute',
    icons: [
      { name: 'azure-functions', description: 'serverless function' },
      { name: 'azure-vm', description: 'virtual machine' },
      { name: 'azure-aks', description: 'managed Kubernetes' },
      { name: 'azure-app-service', description: 'managed web app hosting' },
      { name: 'azure-container-instances', description: 'serverless containers' },
    ],
  },
  {
    category: 'Storage',
    icons: [
      { name: 'azure-storage', description: 'general storage account' },
      { name: 'azure-blob', description: 'object/blob storage' },
    ],
  },
  {
    category: 'Database',
    icons: [
      { name: 'azure-sql', description: 'managed SQL Server DB' },
      { name: 'azure-cosmos-db', description: 'globally distributed NoSQL DB' },
      { name: 'azure-postgresql', description: 'managed PostgreSQL' },
      { name: 'azure-redis', description: 'managed Redis cache' },
    ],
  },
  {
    category: 'Networking',
    icons: [
      { name: 'azure-virtual-network', description: 'private network (VNet)' },
      { name: 'azure-load-balancer', description: 'L4 load balancer' },
      { name: 'azure-cdn', description: 'content delivery network' },
      { name: 'azure-front-door', description: 'global L7 routing/CDN' },
      { name: 'azure-traffic-manager', description: 'DNS-based traffic routing' },
    ],
  },
  {
    category: 'Messaging & Eventing',
    icons: [
      { name: 'azure-service-bus', description: 'enterprise message broker' },
      { name: 'azure-event-hub', description: 'high-throughput event ingestion' },
      { name: 'azure-event-grid', description: 'event routing service' },
    ],
  },
  {
    category: 'Security & Identity',
    icons: [
      { name: 'azure-active-directory', description: 'identity provider' },
      { name: 'azure-key-vault', description: 'secrets and key management' },
    ],
  },
  {
    category: 'Observability',
    icons: [
      { name: 'azure-monitor', description: 'metrics and alerts' },
      { name: 'azure-app-insights', description: 'application performance monitoring' },
    ],
  },
  {
    category: 'Integration & ML',
    icons: [
      { name: 'azure-logic-apps', description: 'workflow automation' },
      { name: 'azure-api-management', description: 'API gateway' },
      { name: 'azure-synapse', description: 'analytics and data warehouse' },
      { name: 'azure-ml', description: 'machine learning platform' },
    ],
  },
  {
    category: 'Generic Azure',
    icons: [{ name: 'azure', description: 'Azure service (use only if no specific icon fits)' }],
  },
];

// ─── GCP ─────────────────────────────────────────────────────────────────────

const GCP_ICONS: IconCategory[] = [
  {
    category: 'Compute',
    icons: [
      { name: 'gcp-cloud-functions', description: 'serverless function' },
      { name: 'gcp-compute-engine', description: 'virtual machine' },
      { name: 'gcp-gke', description: 'managed Kubernetes' },
      { name: 'gcp-cloud-run', description: 'serverless containers' },
      { name: 'gcp-app-engine', description: 'managed app platform' },
    ],
  },
  {
    category: 'Storage',
    icons: [{ name: 'gcp-cloud-storage', description: 'object storage' }],
  },
  {
    category: 'Database',
    icons: [
      { name: 'gcp-cloud-sql', description: 'managed SQL DB' },
      { name: 'gcp-bigtable', description: 'wide-column NoSQL DB' },
      { name: 'gcp-firestore', description: 'document NoSQL DB' },
      { name: 'gcp-spanner', description: 'globally consistent SQL DB' },
      { name: 'gcp-memorystore', description: 'managed Redis/Memcached' },
    ],
  },
  {
    category: 'Networking',
    icons: [
      { name: 'gcp-vpc', description: 'virtual private cloud' },
      { name: 'gcp-cloud-load-balancing', description: 'global load balancer' },
      { name: 'gcp-cloud-cdn', description: 'content delivery network' },
      { name: 'gcp-cloud-dns', description: 'managed DNS' },
      { name: 'gcp-cloud-armor', description: 'WAF / DDoS protection' },
    ],
  },
  {
    category: 'Messaging & Eventing',
    icons: [
      { name: 'gcp-pubsub', description: 'pub/sub messaging' },
      { name: 'gcp-eventarc', description: 'event delivery' },
    ],
  },
  {
    category: 'Security & Identity',
    icons: [
      { name: 'gcp-iam', description: 'identity and access management' },
      { name: 'gcp-kms', description: 'key management service' },
      { name: 'gcp-secret-manager', description: 'secret storage' },
    ],
  },
  {
    category: 'Observability',
    icons: [
      { name: 'gcp-cloud-monitoring', description: 'metrics and dashboards' },
      { name: 'gcp-cloud-logging', description: 'log aggregation' },
    ],
  },
  {
    category: 'Analytics & ML',
    icons: [
      { name: 'gcp-bigquery', description: 'serverless data warehouse' },
      { name: 'gcp-dataflow', description: 'stream/batch processing' },
      { name: 'gcp-vertex-ai', description: 'machine learning platform' },
    ],
  },
  {
    category: 'Generic GCP',
    icons: [{ name: 'gcp', description: 'Google Cloud service (use only if no specific icon fits)' }],
  },
];

// ─── Generic / cloud-agnostic ────────────────────────────────────────────────

const GENERIC_ICONS: IconCategory[] = [
  {
    category: 'Compute',
    icons: [
      { name: 'server', description: 'physical or virtual server' },
      { name: 'microservice', description: 'self-contained service' },
      { name: 'container', description: 'container runtime' },
      { name: 'function', description: 'serverless function' },
      { name: 'web-server', description: 'HTTP web server' },
      { name: 'api', description: 'REST/GraphQL API service' },
      { name: 'gateway', description: 'API gateway' },
    ],
  },
  {
    category: 'Data',
    icons: [
      { name: 'database', description: 'generic database' },
      { name: 'nosql', description: 'NoSQL database' },
      { name: 'data-warehouse', description: 'analytical data store' },
      { name: 'object-storage', description: 'blob/object store' },
    ],
  },
  {
    category: 'Networking',
    icons: [
      { name: 'router', description: 'network router' },
      { name: 'dns', description: 'DNS service' },
      { name: 'vpn', description: 'VPN tunnel' },
      { name: 'load-balancer', description: 'load balancer' },
      { name: 'firewall', description: 'firewall' },
      { name: 'cdn', description: 'CDN edge' },
      { name: 'proxy', description: 'reverse proxy' },
    ],
  },
  {
    category: 'Messaging',
    icons: [
      { name: 'queue', description: 'message queue' },
      { name: 'message-broker', description: 'message broker' },
      { name: 'event-bus', description: 'event bus' },
    ],
  },
  {
    category: 'Security',
    icons: [
      { name: 'auth', description: 'authentication service' },
      { name: 'key', description: 'key/secret store' },
      { name: 'shield', description: 'security/protection layer' },
    ],
  },
  {
    category: 'Observability',
    icons: [
      { name: 'monitoring', description: 'monitoring/dashboard' },
      { name: 'logs', description: 'log aggregation' },
      { name: 'metrics', description: 'metrics store' },
    ],
  },
  {
    category: 'Clients & Edge',
    icons: [
      { name: 'user', description: 'end user / actor' },
      { name: 'mobile', description: 'mobile client' },
      { name: 'browser', description: 'browser / web client' },
      { name: 'iot', description: 'IoT device' },
    ],
  },
  {
    category: 'Tooling',
    icons: [
      { name: 'kubernetes', description: 'Kubernetes cluster' },
      { name: 'docker', description: 'Docker container' },
      { name: 'redis', description: 'Redis cache' },
      { name: 'kafka', description: 'Apache Kafka' },
      { name: 'nginx', description: 'Nginx server' },
      { name: 'postgres', description: 'PostgreSQL database' },
      { name: 'mysql', description: 'MySQL database' },
      { name: 'mongodb', description: 'MongoDB database' },
      { name: 'elasticsearch', description: 'Elasticsearch / search index' },
    ],
  },
  {
    category: 'Misc',
    icons: [
      { name: 'cloud', description: 'generic cloud' },
      { name: 'cache', description: 'cache layer' },
      { name: 'analytics', description: 'analytics engine' },
      { name: 'ai', description: 'AI/ML service' },
      { name: 'email', description: 'email service' },
      { name: 'default', description: 'generic component (fallback)' },
    ],
  },
];

// ─── Catalog assembly ────────────────────────────────────────────────────────

export const ICON_CATALOG: IconPlatformGroup[] = [
  { platform: 'aws', displayName: 'AWS', brandColor: '#FF9900', categories: AWS_ICONS },
  { platform: 'azure', displayName: 'Azure', brandColor: '#0078D4', categories: AZURE_ICONS },
  { platform: 'gcp', displayName: 'Google Cloud (GCP)', brandColor: '#4285F4', categories: GCP_ICONS },
  { platform: 'generic', displayName: 'Generic / cloud-agnostic', brandColor: '#64748b', categories: GENERIC_ICONS },
];

/**
 * Flat list of every supported icon name, in catalog order.
 */
export const ALL_ICON_NAMES: string[] = ICON_CATALOG.flatMap((p) =>
  p.categories.flatMap((c) => c.icons.map((i) => i.name)),
);

/**
 * Look up which platform an icon belongs to.
 */
export function getIconPlatform(name: string): IconPlatform | undefined {
  for (const group of ICON_CATALOG) {
    for (const cat of group.categories) {
      if (cat.icons.some((i) => i.name === name)) return group.platform;
    }
  }
  return undefined;
}

/**
 * Renders the catalog as a structured prompt section grouped by platform.
 * Used by the diagram generator to instruct the AI on what icons exist.
 */
export function formatIconCatalogForPrompt(): string {
  const lines: string[] = ['Available icons (grouped by platform — pick the most specific match):'];
  for (const group of ICON_CATALOG) {
    lines.push('');
    lines.push(`${group.displayName} icons:`);
    for (const category of group.categories) {
      const items = category.icons
        .map((i) => `${i.name} (${i.description})`)
        .join(', ');
      lines.push(`  ${category.category}: ${items}`);
    }
  }
  return lines.join('\n');
}

/**
 * The platform-locking rules block injected into every diagram system prompt.
 * Prevents the AI from mixing AWS / Azure / GCP icons in the same diagram
 * unless the user explicitly asks for a multi-cloud architecture.
 */
export function buildIconSelectionRules(): string {
  return [
    '',
    'ICON SELECTION (CRITICAL):',
    '- Detect the target platform from the user prompt. Mentions of AWS, Amazon Web Services, Lambda, S3, DynamoDB, EC2, EKS, etc. mean AWS. Mentions of Azure, Microsoft cloud, AKS, Cosmos DB, Blob Storage mean Azure. Mentions of GCP, Google Cloud, GKE, BigQuery, Pub/Sub, Cloud Run mean GCP.',
    '- Use ONLY icons from the detected platform group for that platform\'s components. Do NOT mix AWS, Azure, and GCP icons in the same diagram unless the user explicitly asks for a multi-cloud architecture.',
    '- Always prefer the most specific icon (e.g. aws-rds over aws over database). Use the generic platform icon (aws / azure / gcp) only when no specific icon fits.',
    '- For platform-agnostic concepts (user, browser, mobile, message-broker, monitoring, etc.) use the Generic icons.',
    '- Use only icon names from the Available icons list. Never invent new names.',
  ].join('\n');
}
