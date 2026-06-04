/**
 * Cloud service SVG icons used for diagram nodes.
 * Each icon is an inline SVG string rendered inside custom React Flow nodes.
 */

const CLOUD_ICONS: Record<string, string> = {
  'aws-lambda':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/><path d="M8 10l2 4 2-4 2 4 2-4"/></svg>',
  'aws-s3':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>',
  'aws-dynamodb':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M10 6v12"/></svg>',
  'aws-api-gateway':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 4h16v16H4z"/><path d="M9 8l3 4-3 4"/><path d="M15 8l-3 4 3 4"/></svg>',
  'aws-cloudwatch':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  'aws-ec2':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8z"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/></svg>',
  'aws-rds':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 10v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/><path d="M5 14v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/></svg>',
  'aws-sqs':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h4M7 14h6"/><path d="M15 10l2 2-2 2"/></svg>',
  'aws-cloudfront':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M2 12h20"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  'aws-sns':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M12 3v4M12 17v4"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  'aws-ecs':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6" y="6" width="5" height="5" rx="1"/><rect x="13" y="6" width="5" height="5" rx="1"/><rect x="6" y="13" width="5" height="5" rx="1"/></svg>',
  'aws-eks':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>',
  'aws-elasticache':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'aws-kinesis':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 8c4-2 8 2 12 0s4-2 4-2"/><path d="M4 12c4-2 8 2 12 0s4-2 4-2"/><path d="M4 16c4-2 8 2 12 0s4-2 4-2"/></svg>',
  'aws-step-functions':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="20" r="2"/><path d="M12 6v4M12 14v4"/></svg>',
  azure:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><path d="M6 20L13 4h5l-3 8h4L8 20h-2z"/></svg>',
  'azure-functions':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'azure-storage':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  'azure-sql':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/></svg>',
  'azure-cosmos-db':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  gcp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M14.5 3.5L12 2 9.5 3.5 7 2v4l2.5 1.5L12 6l2.5 1.5L17 6V2l-2.5 1.5z"/><path d="M7 8v8l5 3 5-3V8l-5-3-5 3z"/></svg>',
  'gcp-cloud-functions':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'gcp-cloud-storage':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
  'gcp-bigquery':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M12 11v5M16 9v7"/></svg>',
  kubernetes:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#326CE5" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7.5 9.5l9 5M7.5 14.5l9-5"/></svg>',
  docker:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#2496ED" stroke-width="1.5"><path d="M4 12h3v3H4zM8 12h3v3H8zM12 12h3v3h-3zM8 8h3v3H8zM12 8h3v3h-3zM16 12h3v3h-3z"/><path d="M2 14c0 0 1 4 10 4s10-4 10-4"/></svg>',
  database:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>',
  server:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 7h.01M7 18h.01"/></svg>',
  cloud:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  user:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  'load-balancer':
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M12 8v3M9 13l-3 3M15 13l3 3"/></svg>',
  firewall:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 3v18M3 15h18"/></svg>',
  queue:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="2" y="7" width="4" height="10" rx="1"/><rect x="8" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/><path d="M20 12h2M20 10l2 2-2 2"/></svg>',
  cache:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  cdn:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M2 12h20"/><path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"/></svg>',
  monitoring:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M7 13l3-3 2 2 5-5"/><path d="M8 21h8M12 17v4"/></svg>',
  default:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/></svg>',
};

/**
 * Returns the SVG string for a given cloud icon name.
 * Falls back to the default icon if name is not found.
 */
export function getCloudIcon(iconName: string): string {
  return CLOUD_ICONS[iconName] || CLOUD_ICONS['default'];
}
