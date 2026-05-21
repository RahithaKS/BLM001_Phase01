import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthUser } from '@/lib/auth';
import { 
  TrendingUp,
  Eye,
  CreditCard,
  Key,
  Upload,
  Trash2,
  Edit,
  Settings,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

export default function AdminSettings() {
  const currentUser = useAuthUser();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: currentUser?.displayName || 'John Smith',
    email: currentUser?.username || 'johnsmith@ledgerlm.ai',
    organization: 'LedgerLM',
    role: 'Admin',
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-profile-views">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Profile Views</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">20</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+12%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-subscription">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Subscription</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-manage-plan">
                Manage Plan
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">Enterprise</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Licenses</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-manage-seats">
                Manage Seats
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">12/50</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Manage your profile information and preferences</CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(!isEditing)}
              data-testid="button-edit-profile"
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl">{getInitials(profileData.fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" data-testid="button-upload-image">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <Button variant="outline" size="sm" data-testid="button-delete-image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                256x256 max 2MB
              </p>
            </div>

            {/* Profile Fields */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="fullName"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-full-name"
                  />
                  {!isEditing && <Edit className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-email"
                  />
                  {!isEditing && <Edit className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <div>
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={profileData.organization}
                  disabled
                  className="mt-1 bg-muted"
                  data-testid="input-organization"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={profileData.role}
                  disabled
                  className="mt-1 bg-muted"
                  data-testid="input-role"
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end mt-6">
              <Button data-testid="button-save-profile">Save Changes</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account & Security */}
      <Card>
        <CardHeader>
          <CardTitle>Account & Security</CardTitle>
          <CardDescription>Manage access, API integrations, and ownership</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Manage API Settings */}
            <Card className="border-dashed" data-testid="card-api-settings">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Manage API Settings</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage your API keys and integration settings
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="button-manage-api-keys">
                  Manage API Keys
                </Button>
              </CardContent>
            </Card>

            {/* Transfer Ownership */}
            <Card className="border-dashed" data-testid="card-transfer-ownership">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Transfer Admin Ownership</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transfer admin ownership securely
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="button-transfer-ownership">
                  Transfer Ownership
                </Button>
              </CardContent>
            </Card>

            {/* Delete Account */}
            <Card className="border-dashed border-destructive/50" data-testid="card-delete-account">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Remove your account</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete admin account
                    </p>
                  </div>
                </div>
                <Button variant="destructive" className="w-full mt-4" data-testid="button-delete-account">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
