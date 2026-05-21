import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { type BoardTemplate } from '@shared/schema';
import { cn } from '@/lib/utils';

interface BoardTemplateGridProps {
  templates: BoardTemplate[];
  selectedTemplateId?: string;
  onSelectTemplate: (template: BoardTemplate) => void;
}

export function BoardTemplateGrid({ templates, selectedTemplateId, onSelectTemplate }: BoardTemplateGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => (
        <Card
          key={template.id}
          className={cn(
            "p-6 cursor-pointer transition-all hover-elevate",
            selectedTemplateId === template.id && "ring-2 ring-primary"
          )}
          onClick={() => onSelectTemplate(template)}
          data-testid={`card-template-${template.slug}`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <h3 className="font-semibold text-foreground" data-testid={`text-template-name-${template.slug}`}>
                {template.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-template-description-${template.slug}`}>
                {template.description}
              </p>
            </div>
            {selectedTemplateId === template.id && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-3">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
