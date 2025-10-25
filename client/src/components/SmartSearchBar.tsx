import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  X, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  DollarSign,
  BarChart3
} from "lucide-react";

interface SmartSearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  isSearching?: boolean;
}

export interface SearchFilters {
  signal?: 'BUY' | 'SELL' | null;
  minFF?: number;
  maxFF?: number;
  minQuality?: number;
  minLiquidity?: number;
  maxDTE?: number;
  minDTE?: number;
  hasEarnings?: boolean;
  sector?: string;
  minProbability?: number;
  sortBy?: 'ff' | 'quality' | 'liquidity' | 'dte' | 'probability';
  sortOrder?: 'asc' | 'desc';
}

const EXAMPLE_QUERIES = [
  "High quality sell signals",
  "Buy opportunities with good liquidity",
  "Opportunities expiring within 30 days",
  "Strong signals above 50% forward factor",
  "No earnings events",
  "Tech sector only"
];

const QUERY_PATTERNS: Array<{
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<SearchFilters>;
}> = [
  // Signal patterns
  {
    pattern: /\b(buy|long|bullish)\b/i,
    extractor: () => ({ signal: 'BUY' })
  },
  {
    pattern: /\b(sell|short|bearish)\b/i,
    extractor: () => ({ signal: 'SELL' })
  },
  // Quality patterns
  {
    pattern: /\b(high|good|excellent|best)\s+quality\b/i,
    extractor: () => ({ minQuality: 7 })
  },
  {
    pattern: /\bquality\s+(above|over|>)\s+(\d+)/i,
    extractor: (match) => ({ minQuality: parseInt(match[2]) })
  },
  // Liquidity patterns
  {
    pattern: /\b(high|good|excellent)\s+liquidity\b/i,
    extractor: () => ({ minLiquidity: 70 })
  },
  {
    pattern: /\bliquidity\s+(above|over|>)\s+(\d+)/i,
    extractor: (match) => ({ minLiquidity: parseInt(match[2]) })
  },
  // Forward Factor patterns
  {
    pattern: /\b(strong|high)\s+(signal|ff|forward\s+factor)/i,
    extractor: () => ({ minFF: 40 })
  },
  {
    pattern: /\bff\s+(above|over|>)\s+(\d+)/i,
    extractor: (match) => ({ minFF: parseInt(match[2]) })
  },
  {
    pattern: /\bforward\s+factor\s+(above|over|>)\s+(\d+)/i,
    extractor: (match) => ({ minFF: parseInt(match[2]) })
  },
  // DTE patterns
  {
    pattern: /\bexpiring?\s+(within|in)\s+(\d+)\s+days?\b/i,
    extractor: (match) => ({ maxDTE: parseInt(match[2]) })
  },
  {
    pattern: /\b(\d+)\s+days?\s+to\s+expir/i,
    extractor: (match) => ({ maxDTE: parseInt(match[1]) })
  },
  {
    pattern: /\bshort\s+(term|dte)/i,
    extractor: () => ({ maxDTE: 30 })
  },
  {
    pattern: /\blong\s+(term|dte)/i,
    extractor: () => ({ minDTE: 60 })
  },
  // Earnings patterns
  {
    pattern: /\b(no|without|exclude)\s+earnings?\b/i,
    extractor: () => ({ hasEarnings: false })
  },
  {
    pattern: /\b(with|has|include)\s+earnings?\b/i,
    extractor: () => ({ hasEarnings: true })
  },
  // Probability patterns
  {
    pattern: /\bprobability\s+(above|over|>)\s+(\d+)/i,
    extractor: (match) => ({ minProbability: parseInt(match[2]) })
  },
  {
    pattern: /\b(high|good)\s+probability\b/i,
    extractor: () => ({ minProbability: 70 })
  },
  // Sector patterns
  {
    pattern: /\b(tech|technology)\s+sector\b/i,
    extractor: () => ({ sector: 'Technology' })
  },
  {
    pattern: /\b(finance|financial|bank)\s+sector\b/i,
    extractor: () => ({ sector: 'Financial' })
  },
  {
    pattern: /\b(healthcare|health|pharma)\s+sector\b/i,
    extractor: () => ({ sector: 'Healthcare' })
  },
  // Sort patterns
  {
    pattern: /\bsort\s+by\s+(quality|liquidity|ff|dte|probability)/i,
    extractor: (match) => ({ sortBy: match[1].toLowerCase() as any })
  }
];

export function SmartSearchBar({ onSearch, onClear, isSearching }: SmartSearchBarProps) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [parsedFilters, setParsedFilters] = useState<SearchFilters>({});
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const parseNaturalLanguage = (text: string): SearchFilters => {
    const filters: SearchFilters = {};
    const tags: string[] = [];
    
    for (const { pattern, extractor } of QUERY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const extractedFilters = extractor(match);
        Object.assign(filters, extractedFilters);
        
        // Generate tags for visual feedback
        if (extractedFilters.signal) {
          tags.push(`Signal: ${extractedFilters.signal}`);
        }
        if (extractedFilters.minQuality) {
          tags.push(`Quality ≥ ${extractedFilters.minQuality}`);
        }
        if (extractedFilters.minLiquidity) {
          tags.push(`Liquidity ≥ ${extractedFilters.minLiquidity}`);
        }
        if (extractedFilters.minFF) {
          tags.push(`|FF| ≥ ${extractedFilters.minFF}%`);
        }
        if (extractedFilters.maxDTE) {
          tags.push(`Expires ≤ ${extractedFilters.maxDTE}d`);
        }
        if (extractedFilters.minDTE) {
          tags.push(`Expires ≥ ${extractedFilters.minDTE}d`);
        }
        if (extractedFilters.hasEarnings === false) {
          tags.push("No Earnings");
        }
        if (extractedFilters.hasEarnings === true) {
          tags.push("Has Earnings");
        }
        if (extractedFilters.minProbability) {
          tags.push(`Probability ≥ ${extractedFilters.minProbability}%`);
        }
        if (extractedFilters.sector) {
          tags.push(`Sector: ${extractedFilters.sector}`);
        }
      }
    }
    
    setFilterTags(tags);
    return filters;
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    
    if (text.length > 2) {
      const filters = parseNaturalLanguage(text);
      setParsedFilters(filters);
    } else {
      setParsedFilters({});
      setFilterTags([]);
    }
  };
  
  const handleSearch = () => {
    if (Object.keys(parsedFilters).length > 0) {
      onSearch(parsedFilters);
      setShowSuggestions(false);
    }
  };
  
  const handleClear = () => {
    setQuery("");
    setParsedFilters({});
    setFilterTags([]);
    onClear();
    inputRef.current?.focus();
  };
  
  const handleExampleClick = (example: string) => {
    setQuery(example);
    const filters = parseNaturalLanguage(example);
    setParsedFilters(filters);
    setShowSuggestions(false);
    onSearch(filters);
  };
  
  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="Search naturally: 'high quality sell signals with good liquidity'"
            className="pl-10 pr-10"
            data-testid="input-smart-search"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button 
          onClick={handleSearch}
          disabled={Object.keys(parsedFilters).length === 0 || isSearching}
          data-testid="button-smart-search"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>
      
      {/* Filter Tags */}
      {filterTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filterTags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      
      {/* Suggestions Dropdown */}
      {showSuggestions && !query && (
        <Card className="absolute z-10 w-full mt-2 p-3">
          <div className="text-sm text-muted-foreground mb-2">Try searching for:</div>
          <div className="space-y-1">
            {EXAMPLE_QUERIES.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left px-2 py-1 text-sm rounded hover-elevate"
                data-testid={`suggestion-${i}`}
              >
                {example}
              </button>
            ))}
          </div>
        </Card>
      )}
      
      {/* Understanding Indicator */}
      {query.length > 2 && Object.keys(parsedFilters).length > 0 && (
        <div className="absolute right-0 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Understanding: {filterTags.length} filter{filterTags.length !== 1 ? 's' : ''} applied
          </span>
        </div>
      )}
    </div>
  );
}