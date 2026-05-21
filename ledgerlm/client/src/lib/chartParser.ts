export interface ChartSpec {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<Record<string, string | number>>;
  config: {
    xKey?: string;
    yKey?: string;
    xLabel?: string;
    yLabel?: string;
    color?: string;
    entities?: string[];
    periods?: string[];
    periodMode?: 'grouped-bar' | 'line';
    monthData?: Record<string, Array<Record<string, string | number>>>;
  };
}

export interface ParsedContent {
  textContent: string;
  charts: ChartSpec[];
}

export function parseCharts(content: string): ParsedContent {
  const chartRegex = /```chart\s*\n([\s\S]*?)\n```/g;
  const charts: ChartSpec[] = [];
  let textContent = content;
  
  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    try {
      const chartJson = match[1].trim();
      const chartSpec = JSON.parse(chartJson) as ChartSpec;
      
      if (chartSpec.type && chartSpec.data && Array.isArray(chartSpec.data)) {
        charts.push(chartSpec);
      }
    } catch (error) {
      console.error('Failed to parse chart specification:', error);
    }
  }
  
  textContent = textContent.replace(chartRegex, '');
  
  return {
    textContent: textContent.trim(),
    charts,
  };
}
