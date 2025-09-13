import { Accessibility } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-gradient-card border-b border-border">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-lg shadow-lg">
            <Accessibility className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>
              WebTECH Consulting
            </h1>
            <p className="text-muted-foreground">
              Free ADA Accessibility Audit Tool
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;