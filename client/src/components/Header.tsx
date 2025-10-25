import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderProps {
  currentPage?: "scanner" | "history" | "watchlists" | "paper-trading";
}

export function Header({ currentPage = "scanner" }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();

  const handleNavigate = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { href: "/", label: "Scanner", id: "scanner" },
    { href: "/watchlists", label: "Watchlists", id: "watchlists" },
    { href: "/history", label: "History", id: "history" },
    { href: "/paper-trading", label: "Paper Trading", id: "paper-trading" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Title - Always visible */}
          <div className="flex items-center gap-2 md:gap-6">
            {/* Mobile Menu Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button 
                  variant="ghost" 
                  size="icon"
                  data-testid="button-mobile-menu"
                  className="h-10 w-10"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Navigation
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-2">
                  {navItems.map((item) => (
                    <Button
                      key={item.id}
                      variant={currentPage === item.id ? "default" : "ghost"}
                      className="justify-start w-full h-12"
                      onClick={() => handleNavigate(item.href)}
                      data-testid={`mobile-link-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Title Section */}
            <Link 
              href="/" 
              className={`flex items-center gap-2 md:gap-3 hover-elevate active-elevate-2 px-2 md:px-3 py-1 md:py-2 rounded-md ${!isMobile ? '' : ''}`}
              data-testid="link-home"
            >
              <div className="p-1.5 md:p-2 rounded-md bg-primary/10">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-semibold tracking-tight">
                  VolEdge
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Research-based volatility mispricing detector
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.id} href={item.href}>
                  <Badge 
                    variant={currentPage === item.id ? "default" : "outline"} 
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`link-${item.id}`}
                  >
                    {item.label}
                  </Badge>
                </Link>
              ))}
            </nav>
          </div>

          {/* Theme Toggle - Always visible */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}