import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Mail, Key, Ticket, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AdminDashboardProps {
  domainId: string;
  domain?: {
    name: string;
    userCount: number;
    userQuota?: number | null;
  };
}

interface DomainStats {
  seatsUsed: number;
  seatsTotal: number;
  pendingInvites: number;
  activeLicenses: number;
  totalLicenses: number;
  openTickets: number;
  dailyTokenUsage: Array<{ date: string; tokens: number }>;
  monthlyTokenUsage: Array<{ month: string; tokens: number }>;
}

export default function AdminDashboard({ domainId, domain }: AdminDashboardProps) {
  const { data: stats, isLoading } = useQuery<DomainStats>({
    queryKey: ['/api/domain-admin/stats', domainId],
    enabled: !!domainId,
  });

  const seatsUsed = domain?.userCount || stats?.seatsUsed || 0;
  const seatsTotal = domain?.userQuota || stats?.seatsTotal || 50;
  
  const dailyData = stats?.dailyTokenUsage || [
    { date: '1 Jan', tokens: 120 },
    { date: '2 Jan', tokens: 180 },
    { date: '3 Jan', tokens: 90 },
    { date: '4 Jan', tokens: 210 },
    { date: '5 Jan', tokens: 150 },
    { date: '6 Jan', tokens: 280 },
    { date: '7 Jan', tokens: 190 },
  ];

  const monthlyData = stats?.monthlyTokenUsage || [
    { month: 'Jan', tokens: 800 },
    { month: 'Feb', tokens: 650 },
    { month: 'Mar', tokens: 920 },
    { month: 'Apr', tokens: 780 },
    { month: 'May', tokens: 1100 },
    { month: 'Jun', tokens: 950 },
    { month: 'Jul', tokens: 1200 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'Seats Used/Total',
      value: `${seatsUsed}/${seatsTotal}`,
      trend: '+8.5%',
      trendUp: true,
      comparison: 'vs last month',
      icon: Users,
    },
    {
      title: 'Pending Invites',
      value: stats?.pendingInvites?.toString() || '0',
      trend: '+12%',
      trendUp: true,
      comparison: 'vs yesterday',
      action: 'Approve',
      icon: Mail,
    },
    {
      title: 'Active Licenses',
      value: `${stats?.activeLicenses || seatsUsed}/${stats?.totalLicenses || seatsTotal}`,
      trend: '+5.2%',
      trendUp: true,
      comparison: 'vs last month',
      action: 'Assign License',
      icon: Key,
    },
    {
      title: 'Open Tickets',
      value: stats?.openTickets?.toString() || '0',
      trend: '-3.1%',
      trendUp: false,
      comparison: 'vs last week',
      action: 'View Tickets',
      icon: Ticket,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} data-testid={`metric-card-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{card.title}</span>
                  {card.action && (
                    <button className="text-xs text-primary hover:underline flex items-center gap-1" data-testid={`action-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      {card.action}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{card.value}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {card.trendUp ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={card.trendUp ? 'text-green-500' : 'text-red-500'}>
                    {card.trend}
                  </span>
                  <span className="text-muted-foreground">{card.comparison}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Token Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="chart-daily-tokens">
          <CardHeader>
            <CardTitle className="text-base">Daily Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="chart-monthly-tokens">
          <CardHeader>
            <CardTitle className="text-base">Monthly Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
