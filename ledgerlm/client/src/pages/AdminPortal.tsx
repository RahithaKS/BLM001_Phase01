import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Users, 
  UsersRound, 
  Key, 
  Ticket, 
  Settings,
  ChevronLeft,
  UserPlus,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/lib/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminUserDetails from '@/components/admin/AdminUserDetails';
import AdminGroupsRoles from '@/components/admin/AdminGroupsRoles';
import AdminLicenses from '@/components/admin/AdminLicenses';
import AdminSettings from '@/components/admin/AdminSettings';

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: {
    id: string;
    name: string;
    adminEmail: string;
    userCount: number;
    userQuota?: number | null;
  };
  domains?: Array<{
    id: string;
    name: string;
    adminEmail: string;
    userQuota?: number | null;
  }>;
}

type AdminSection = 'dashboard' | 'users' | 'groups' | 'licenses' | 'settings';

const navItems = [
  { id: 'dashboard' as AdminSection, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users' as AdminSection, label: 'User Details', icon: Users },
  { id: 'groups' as AdminSection, label: 'Groups & Roles', icon: UsersRound },
  { id: 'licenses' as AdminSection, label: 'Licenses', icon: Key },
  { id: 'settings' as AdminSection, label: 'Admin Settings', icon: Settings },
];

export default function AdminPortal() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const currentUser = useAuthUser();

  const { data: domainInfo, isLoading: domainLoading } = useQuery<DomainInfo>({
    queryKey: ['/api/domain-admin/my-domain'],
  });

  const isSuperAdmin = domainInfo?.isSuperAdmin || false;
  const activeDomainId = isSuperAdmin ? selectedDomainId : domainInfo?.domain?.id || '';
  const activeDomain = isSuperAdmin
    ? domainInfo?.domains?.find(d => d.id === selectedDomainId)
    : domainInfo?.domain;

  // Set initial domain for super admin
  if (isSuperAdmin && !selectedDomainId && domainInfo?.domains?.[0]) {
    setSelectedDomainId(domainInfo.domains[0].id);
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard domainId={activeDomainId} domain={activeDomain} />;
      case 'users':
        return <AdminUserDetails domainId={activeDomainId} domain={activeDomain} onInviteUser={() => setIsInviteModalOpen(true)} />;
      case 'groups':
        return <AdminGroupsRoles domainId={activeDomainId} />;
      case 'licenses':
        return <AdminLicenses domainId={activeDomainId} domain={activeDomain} />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard domainId={activeDomainId} domain={activeDomain} />;
    }
  };

  return (
    <div className="flex h-full bg-background" data-testid="admin-portal">
      {/* Left Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/dashboard')}
              data-testid="button-back-dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold text-lg">Admin Portal</h1>
          </div>
        </div>

        {/* Domain Selector for Super Admin */}
        {isSuperAdmin && domainInfo?.domains && (
          <div className="p-4 border-b">
            <label className="text-xs text-muted-foreground mb-2 block">Select Domain</label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger data-testid="select-domain">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {domainInfo.domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3" />
                      {domain.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover-elevate"
                )}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.displayName || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.username}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b bg-card px-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold">
              {navItems.find(n => n.id === activeSection)?.label || 'Dashboard'}
            </h2>
            {activeDomain && (
              <p className="text-xs text-muted-foreground">{activeDomain.name}</p>
            )}
          </div>
          {activeSection === 'users' && (
            <Button onClick={() => setIsInviteModalOpen(true)} data-testid="button-invite-user-header">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite New User
            </Button>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {domainLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !activeDomainId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Please select a domain to continue
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </div>
  );
}
