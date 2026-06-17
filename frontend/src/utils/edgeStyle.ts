// ─── Edge Style Resolution ───────────────────────────────────────────────────

export interface ResolvedEdgeStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  animated: boolean;
  markerType: 'closed' | 'open' | 'none';
}

/**
 * Keyword categories in priority order:
 * 1. HTTP/REST → blue
 * 2. gRPC → purple
 * 3. event/async → amber, dashed, animated
 * 4. SQL/database → green
 * 5. cache → orange
 * 6. log/monitoring → indigo, dashed
 * 7. error/failure → red, dashed
 * 8. SSH/VPN → gray, dashed
 * Default: neutral gray
 */
const KEYWORD_CATEGORIES: Array<{
  pattern: RegExp;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  animated: boolean;
}> = [
  {
    pattern: /https?|http|rest|request|response|api/,
    stroke: '#3b82f6',
    strokeWidth: 2,
    animated: false,
  },
  {
    pattern: /grpc|rpc/,
    stroke: '#8b5cf6',
    strokeWidth: 2,
    animated: false,
  },
  {
    pattern: /event|async|publish|subscribe|trigger|sns|sqs|pubsub|stream|kinesis/,
    stroke: '#f59e0b',
    strokeWidth: 2,
    strokeDasharray: '6 3',
    animated: true,
  },
  {
    pattern: /sql|read|write|query|insert|db|database/,
    stroke: '#10b981',
    strokeWidth: 2,
    animated: false,
  },
  {
    pattern: /cache|redis|memcached/,
    stroke: '#f97316',
    strokeWidth: 2,
    animated: false,
  },
  {
    pattern: /log|metric|monitor|trace|alert/,
    stroke: '#6366f1',
    strokeWidth: 1.5,
    strokeDasharray: '4 2',
    animated: false,
  },
  {
    pattern: /error|fail|reject|dlq/,
    stroke: '#ef4444',
    strokeWidth: 2,
    strokeDasharray: '3 3',
    animated: false,
  },
  {
    pattern: /ssh|vpn|tunnel/,
    stroke: '#64748b',
    strokeWidth: 1.5,
    strokeDasharray: '5 4',
    animated: false,
  },
];

const DEFAULT_STYLE = {
  stroke: '#94a3b8',
  strokeWidth: 2,
  animated: false,
};

/**
 * Validates whether a string is a valid CSS color value.
 * Supports hex (#rgb, #rrggbb, #rrggbbaa), named colors, rgb(), rgba(), hsl(), hsla().
 */
export function isValidCssColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Hex colors: #rgb, #rrggbb, #rgba, #rrggbbaa
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return true;
  }

  // rgb() / rgba()
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return true;
  }

  // hsl() / hsla()
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return true;
  }

  // Named CSS colors (common subset)
  const namedColors = new Set([
    'black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia',
    'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua',
    'orange', 'aliceblue', 'antiquewhite', 'aquamarine', 'azure', 'beige',
    'bisque', 'blanchedalmond', 'blueviolet', 'brown', 'burlywood', 'cadetblue',
    'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson',
    'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen',
    'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange',
    'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
    'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
    'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick',
    'floralwhite', 'forestgreen', 'gainsboro', 'ghostwhite', 'gold',
    'goldenrod', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
    'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
    'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
    'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
    'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
    'lightsteelblue', 'lightyellow', 'limegreen', 'linen', 'magenta',
    'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
    'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
    'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
    'navajowhite', 'oldlace', 'olivedrab', 'orangered', 'orchid',
    'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip',
    'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'rosybrown',
    'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
    'sienna', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
    'springgreen', 'steelblue', 'tan', 'thistle', 'tomato', 'turquoise',
    'violet', 'wheat', 'whitesmoke', 'yellowgreen', 'rebeccapurple',
    'transparent', 'currentcolor',
  ]);

  return namedColors.has(trimmed.toLowerCase());
}

/**
 * Resolves the visual style for an edge based on its label keywords,
 * an optional explicit color override, and arrow style preference.
 */
export function resolveEdgeStyle(
  label: string | undefined,
  explicitColor: string | undefined,
  arrowStyle: 'closed' | 'open' | 'none' | undefined,
): ResolvedEdgeStyle {
  const l = (label || '').toLowerCase();

  // Find matching keyword category
  let matched: (typeof KEYWORD_CATEGORIES)[number] | undefined;
  for (const cat of KEYWORD_CATEGORIES) {
    if (cat.pattern.test(l)) {
      matched = cat;
      break;
    }
  }

  const base = matched ?? DEFAULT_STYLE;

  // Determine stroke color: explicit override takes precedence if valid
  let stroke = base.stroke;
  if (explicitColor && isValidCssColor(explicitColor)) {
    stroke = explicitColor.trim();
  }

  const strokeDasharray: string | undefined =
    matched?.strokeDasharray ?? undefined;

  const result: ResolvedEdgeStyle = {
    stroke,
    strokeWidth: base.strokeWidth,
    animated: base.animated,
    markerType: arrowStyle ?? 'closed',
  };

  if (strokeDasharray) {
    result.strokeDasharray = strokeDasharray;
  }

  return result;
}
