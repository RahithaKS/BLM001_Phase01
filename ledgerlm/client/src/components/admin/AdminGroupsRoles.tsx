import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  MoreHorizontal, 
  Plus, 
  Users,
  Shield,
  Trash2,
  Edit,
  UserPlus,
  Settings,
  ArrowLeft
} from 'lucide-react';

interface AdminGroupsRolesProps {
  domainId: string;
}

interface Group {
  id: string;
  name: string;
  members: number;
  activeTickets: number;
  roleType: string;
  createdBy: string;
}

interface Role {
  id: string;
  name: string;
  permissions: {
    supportTickets: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    groupsRoles: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    userDetails: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    adminSettings: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  };
}

const defaultGroups: Group[] = [
  { id: '1', name: 'Finance Team', members: 12, activeTickets: 5, roleType: 'Advanced', createdBy: 'Admin' },
  { id: '2', name: 'Marketing', members: 8, activeTickets: 3, roleType: 'Basic', createdBy: 'Admin' },
  { id: '3', name: 'Engineering', members: 25, activeTickets: 12, roleType: 'Custom', createdBy: 'Super Admin' },
  { id: '4', name: 'HR Department', members: 6, activeTickets: 2, roleType: 'Basic', createdBy: 'Admin' },
];

const defaultRoles: Role[] = [
  { 
    id: '1', 
    name: 'Super Admin',
    permissions: {
      supportTickets: { view: true, create: true, edit: true, delete: true },
      groupsRoles: { view: true, create: true, edit: true, delete: true },
      userDetails: { view: true, create: true, edit: true, delete: true },
      adminSettings: { view: true, create: true, edit: true, delete: true },
    }
  },
  { 
    id: '2', 
    name: 'Admin',
    permissions: {
      supportTickets: { view: true, create: true, edit: true, delete: true },
      groupsRoles: { view: true, create: true, edit: true, delete: false },
      userDetails: { view: true, create: false, edit: false, delete: false },
      adminSettings: { view: true, create: true, edit: true, delete: false },
    }
  },
  { 
    id: '3', 
    name: 'Manager',
    permissions: {
      supportTickets: { view: true, create: true, edit: true, delete: false },
      groupsRoles: { view: true, create: false, edit: false, delete: false },
      userDetails: { view: true, create: false, edit: false, delete: false },
      adminSettings: { view: false, create: false, edit: false, delete: false },
    }
  },
  { 
    id: '4', 
    name: 'Agent',
    permissions: {
      supportTickets: { view: true, create: true, edit: false, delete: false },
      groupsRoles: { view: false, create: false, edit: false, delete: false },
      userDetails: { view: false, create: false, edit: false, delete: false },
      adminSettings: { view: false, create: false, edit: false, delete: false },
    }
  },
  { 
    id: '5', 
    name: 'Read-only',
    permissions: {
      supportTickets: { view: true, create: false, edit: false, delete: false },
      groupsRoles: { view: true, create: false, edit: false, delete: false },
      userDetails: { view: true, create: false, edit: false, delete: false },
      adminSettings: { view: true, create: false, edit: false, delete: false },
    }
  },
];

export default function AdminGroupsRoles({ domainId }: AdminGroupsRolesProps) {
  const [groups] = useState<Group[]>(defaultGroups);
  const [roles] = useState<Role[]>(defaultRoles);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', roleType: 'basic', description: '' });

  const getRoleTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      Basic: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      Advanced: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      Custom: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      Marketing: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    return <Badge className={colors[type] || colors.Basic}>{type}</Badge>;
  };

  const openPermissionsDialog = (role: Role) => {
    setSelectedRole(role);
    setIsPermissionsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Create Group Card */}
      <Card data-testid="card-create-group">
        <CardHeader>
          <CardTitle className="text-lg">Create a new group</CardTitle>
          <CardDescription>
            Manage support teams and define permissions for agents and admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsCreateGroupDialogOpen(true)} data-testid="button-create-group">
            <Plus className="h-4 w-4 mr-2" />
            Create New Group
          </Button>
        </CardContent>
      </Card>

      {/* Groups and Roles Tabs */}
      <Card>
        <Tabs defaultValue="groups" className="w-full">
          <div className="p-4 border-b">
            <TabsList>
              <TabsTrigger value="groups" data-testid="tab-groups">
                Groups ({groups.length})
              </TabsTrigger>
              <TabsTrigger value="roles" data-testid="tab-roles">
                Roles ({roles.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="groups" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Active Tickets</TableHead>
                  <TableHead>Role Type</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id} data-testid={`row-group-${group.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{group.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{group.members}</TableCell>
                    <TableCell>{group.activeTickets}</TableCell>
                    <TableCell>{getRoleTypeBadge(group.roleType)}</TableCell>
                    <TableCell className="text-muted-foreground">{group.createdBy}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`menu-group-${group.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            View/Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Members
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="h-4 w-4 mr-2" />
                            Assign Role
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="roles" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openPermissionsDialog(role)}
                        data-testid={`button-manage-permissions-${role.id}`}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage permissions
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent data-testid="dialog-create-group">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new group to organize your team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label>Role Type</Label>
              <Select 
                value={newGroup.roleType} 
                onValueChange={(v) => setNewGroup({ ...newGroup, roleType: v })}
              >
                <SelectTrigger data-testid="select-role-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="group-description">Group Description</Label>
              <Textarea
                id="group-description"
                placeholder="Describe the purpose of this group"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                data-testid="input-group-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button data-testid="button-continue-add-members">
              Continue to Add Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-manage-permissions">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsPermissionsDialogOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>Manage Role Permissions</DialogTitle>
            </div>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-6 py-4">
              <div>
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={selectedRole.name}
                  readOnly
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-base">Permission Manager</Label>
                <div className="mt-4 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead className="text-center">View</TableHead>
                        <TableHead className="text-center">Create</TableHead>
                        <TableHead className="text-center">Edit</TableHead>
                        <TableHead className="text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Support Tickets</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.supportTickets.view} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.supportTickets.create} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.supportTickets.edit} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.supportTickets.delete} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Groups & Roles</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.groupsRoles.view} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.groupsRoles.create} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.groupsRoles.edit} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.groupsRoles.delete} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>User Details</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.userDetails.view} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.userDetails.create} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.userDetails.edit} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.userDetails.delete} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Admin Settings</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.adminSettings.view} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.adminSettings.create} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.adminSettings.edit} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={selectedRole.permissions.adminSettings.delete} />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button data-testid="button-save-permissions">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
