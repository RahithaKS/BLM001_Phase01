import { Card } from '@/components/ui/card';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const mockData = [
  {
    title: 'Market Overview',
    value: '+12.5%',
    change: 'up',
    description: 'Overall market performance',
  },
  {
    title: 'Industry Trends',
    value: '+8.3%',
    change: 'up',
    description: 'Sector growth rate',
  },
  {
    title: 'Competitor Analysis',
    value: '-3.2%',
    change: 'down',
    description: 'Relative performance',
  },
];

export default function MarketIntelligence() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-6 border-b flex-shrink-0">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">Market Intelligence</h1>
              <p className="text-muted-foreground">
                Real-time market data and competitive analysis
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mockData.map((item, index) => (
                <Card key={index} className="p-6 space-y-3" data-testid={`card-metric-${index}`}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      item.change === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.change === 'up' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {item.value}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <div className="text-center py-12 space-y-3">
                <TrendingUp className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Advanced Analytics Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Get deeper insights into market trends, competitor performance, and industry benchmarks
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
