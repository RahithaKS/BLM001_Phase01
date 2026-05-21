import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MoreHorizontal, 
  Search, 
  Filter, 
  Key,
  XCircle,
  RefreshCw,
  Activity,
  UserX
} from 'lucide-react';

interface AdminLicensesProps {
  domainId: string;
  domain?: {
    name: string;
    userCount: number;
    userQuota?: number | null;
  };
}

interface LicenseUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'expiring_soon' | 'expired';
  role: string;
  licenseType: 'Basic' | 'Advanced' | 'Custom';
  assignedDate: string;
}

const mockLicenseUsers: LicenseUser[] = [
  { id: '1', email: 'john@company.com', name: 'John Smith', status: 'active', role: 'Admin', licenseType: 'Advanced', assignedDate: '2024-01-15' },
  { id: '2', email: 'sarah@company.com', name: 'Sarah Johnson', status: 'active', role: 'Analyst', licenseType: 'Basic', assignedDate: '2024-02-20' },
  { id: '3', email: 'mike@company.com', name: 'Mike Brown', status: 'expiring_soon', role: 'Operator', licenseType: 'Advanced', assignedDate: '2023-12-01' },
  { id: '4', email: 'emma@company.com', name: 'Emma Wilson', status: 'expired', role: 'User', licenseType: 'Basic', assignedDate: '2023-06-15' },
  { id: '5', email: 'david@company.com', name: 'David Lee', status: 'active', role: 'Admin', licenseType: 'Custom', assignedDate: '2024-03-10' },
];

export default function AdminLicenses({ domainId, domain }: AdminLicensesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [licenseUsers] = useState<LicenseUser[]>(mockLicenseUsers);

  const filteredUsers = licenseUsers.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const usedLicenses = domain?.userCount || 14;
  const totalLicenses = domain?.userQuota || 150;
  const advancedLicenses = { used: 5, total: 10 };
  const basicLicenses = { used: 25, total: 25 };
  const customLicenses = { used: 5, total: 5 };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusBadge = (status: LicenseUser['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Expiring Soon</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Expired</Badge>;
    }
  };

  const getLicenseTypeBadge = (type: LicenseUser['licenseType']) => {
    const colors: Record<string, string> = {
      Basic: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      Advanced: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      Custom: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    };
    return <Badge className={colors[type]}>{type}</Badge>;
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      {/* License Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Used/Total Licenses</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{usedLicenses}/{totalLicenses}</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full" 
                style={{ width: `${(usedLicenses / totalLicenses) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-advanced-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Advanced License</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{advancedLicenses.used}/{advancedLicenses.total}</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${(advancedLicenses.used / advancedLicenses.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-basic-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Basic License</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{basicLicenses.used}/{basicLicenses.total}</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-500 rounded-full" 
                style={{ width: `${(basicLicenses.used / basicLicenses.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-custom-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Custom License</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{customLicenses.used}/{customLicenses.total}</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full" 
                style={{ width: `${(customLicenses.used / customLicenses.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Usage Table */}
      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">License Usage ({filteredUsers.length})</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-licenses"
              />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter-licenses">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox data-testid="checkbox-select-all-licenses" />
              </TableHead>
              <TableHead>User Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>License Type</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No license users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-license-${user.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{user.role}</TableCell>
                  <TableCell>{getLicenseTypeBadge(user.licenseType)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.assignedDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`menu-license-${user.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <XCircle className="h-4 w-4 mr-2" />
                          Revoke License
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reassign Seat
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Activity className="h-4 w-4 mr-2" />
                          View Activity
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <UserX className="h-4 w-4 mr-2" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
