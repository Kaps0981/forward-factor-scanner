import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OpportunityCard } from "./OpportunityCard";
import { Opportunity } from "@shared/schema";
import { Grid3X3, List, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "../lib/csvExport";

interface ResultsContainerProps {
  opportunities: Opportunity[];
  onViewDetails: (opportunity: Opportunity) => void;
  onAddToPaper: (opportunity: Opportunity) => void;
  scanId?: number;
}

export function ResultsContainer({ 
  opportunities, 
  onViewDetails, 
  onAddToPaper,
  scanId 
}: ResultsContainerProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const { toast } = useToast();
  
  // Check if mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const handleExportCSV = () => {
    if (opportunities.length === 0) {
      toast({
        title: "No data to export",
        description: "Run a scan to generate opportunities first.",
        variant: "destructive"
      });
      return;
    }
    
    exportToCSV(opportunities);
    toast({
      title: "CSV Exported",
      description: `Exported ${opportunities.length} opportunities to CSV`,
    });
  };
  
  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No opportunities found. Try adjusting your filters or scanning more tickers.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with view toggle and export */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {opportunities.length} Opportunit{opportunities.length === 1 ? 'y' : 'ies'} Found
        </h2>
        
        {!isMobile && (
          <div className="flex items-center gap-3">
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(value) => value && setViewMode(value as 'cards' | 'table')}
            >
              <ToggleGroupItem 
                value="cards" 
                aria-label="Card view"
                data-testid="toggle-cards"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Cards
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="table" 
                aria-label="Table view"
                data-testid="toggle-table"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        )}
      </div>
      
      {/* Results Display */}
      {viewMode === 'cards' || isMobile ? (
        <OpportunityGrid 
          opportunities={opportunities}
          onViewDetails={onViewDetails}
          onAddToPaper={onAddToPaper}
        />
      ) : (
        <OpportunityTable 
          opportunities={opportunities}
          onViewDetails={onViewDetails}
          onAddToPaper={onAddToPaper}
        />
      )}
      
      {/* Mobile Export Button */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 z-10">
          <Button
            variant="default"
            size="sm"
            onClick={handleExportCSV}
            className="shadow-lg"
            data-testid="button-export-csv-mobile"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function OpportunityGrid({ 
  opportunities, 
  onViewDetails, 
  onAddToPaper 
}: {
  opportunities: Opportunity[];
  onViewDetails: (opportunity: Opportunity) => void;
  onAddToPaper: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {opportunities.map((opportunity, idx) => (
        <OpportunityCard
          key={`${opportunity.ticker}-${idx}`}
          opportunity={opportunity}
          onViewDetails={() => onViewDetails(opportunity)}
          onAddToPaper={() => onAddToPaper(opportunity)}
        />
      ))}
    </div>
  );
}

function OpportunityTable({ 
  opportunities, 
  onViewDetails, 
  onAddToPaper 
}: {
  opportunities: Opportunity[];
  onViewDetails: (opportunity: Opportunity) => void;
  onAddToPaper: (opportunity: Opportunity) => void;
}) {
  const [sortField, setSortField] = useState<keyof Opportunity>('forward_factor');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const sortedOpportunities = [...opportunities].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const handleSort = (field: keyof Opportunity) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <SortableHeader field="ticker" label="Ticker" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="signal" label="Signal" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="forward_factor" label="FF%" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="quality_score" label="Quality" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="probability" label="Win%" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="risk_reward" label="R:R" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="front_dte" label="Front DTE" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <SortableHeader field="back_dte" label="Back DTE" onClick={handleSort} sortField={sortField} sortDirection={sortDirection} />
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedOpportunities.map((opportunity, idx) => (
              <tr 
                key={`${opportunity.ticker}-${idx}`}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onViewDetails(opportunity)}
                data-testid={`row-opportunity-${opportunity.ticker}`}
              >
                <td className="px-4 py-3 font-medium">{opportunity.ticker}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    opportunity.signal === 'BUY' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {opportunity.signal}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">
                  {opportunity.forward_factor > 0 ? '+' : ''}{opportunity.forward_factor.toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${
                    (opportunity.quality_score || 0) >= 70 ? 'text-green-600 dark:text-green-400' :
                    (opportunity.quality_score || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-gray-500'
                  }`}>
                    {opportunity.quality_score ? Math.round(opportunity.quality_score / 10) : '-'}/10
                  </span>
                </td>
                <td className="px-4 py-3">
                  {opportunity.probability ? `${opportunity.probability}%` : '-'}
                </td>
                <td className="px-4 py-3">
                  {opportunity.risk_reward ? `${opportunity.risk_reward.toFixed(1)}:1` : '-'}
                </td>
                <td className="px-4 py-3">{opportunity.front_dte}d</td>
                <td className="px-4 py-3">{opportunity.back_dte}d</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(opportunity)}
                      data-testid={`button-view-table-${opportunity.ticker}`}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddToPaper(opportunity)}
                      data-testid={`button-paper-table-${opportunity.ticker}`}
                    >
                      Trade
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({ 
  field, 
  label, 
  onClick, 
  sortField, 
  sortDirection 
}: {
  field: keyof Opportunity;
  label: string;
  onClick: (field: keyof Opportunity) => void;
  sortField: keyof Opportunity;
  sortDirection: 'asc' | 'desc';
}) {
  const isActive = sortField === field;
  
  return (
    <th 
      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/30"
      onClick={() => onClick(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-primary">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}