import { useState } from "react";
import { Bot, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KioskChatDialog } from "@/components/KioskChatDialog";
import { useAuthUser } from "@/lib/auth";

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: {
    id: string;
    name: string;
  };
}

export default function AgenticWorkflow() {
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const currentUser = useAuthUser();
  
  const { data: domainInfo } = useQuery<DomainInfo>({
    queryKey: ["/api/domain-admin/my-domain"],
    enabled: !!currentUser,
  });
  
  const isBoschUser = currentUser?.username?.toLowerCase().endsWith('@in.bosch.com') || 
                      currentUser?.username?.toLowerCase().endsWith('@bosch.com');
  
  const domainId = domainInfo?.domain?.id || '';

  return (
    <div className="h-full flex flex-col overflow-auto bg-background" data-testid="page-agentic-workflow">
      <div className="p-6 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Agentic Workflow</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered assistants to help streamline your workflows
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isBoschUser && (
            <Card 
              className="hover-elevate cursor-pointer transition-all" 
              onClick={() => setIsKioskOpen(true)}
              data-testid="card-billing-kiosk"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" data-testid="text-kiosk-title">
                      Billing Kiosk
                    </CardTitle>
                    <CardDescription data-testid="text-kiosk-description">
                      NON-MCR Billing Assistant
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Self-service assistant for NON-MCR billing queries. Get instant answers about 
                  contracts, prices, travel billing, purchase billing, and more.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary">
                  <MessageSquare className="h-4 w-4" />
                  <span>Click to start chatting</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!isBoschUser && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agentic workflows available for your account.</p>
              <p className="text-sm mt-1">Contact your administrator for access.</p>
            </div>
          )}
        </div>
      </div>

      {domainId && (
        <KioskChatDialog 
          open={isKioskOpen} 
          onOpenChange={setIsKioskOpen}
          domainId={domainId}
        />
      )}
    </div>
  );
}
