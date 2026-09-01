const Hero = () => {
  return (
    <section className="bg-gradient-hero py-16">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
          <span style={{ color: '#FFFFFF' }}>Free ADA</span> <span className="text-primary">Risk Screening</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Enter your website URL and we'll read your page's code against WCAG 2.1 AA criteria,
          score your risk, and show you exactly which issues are visible in the markup — and
          which ones only a hands-on audit from WebTECH Consulting can settle.
        </p>
        <div className="mt-8 p-6 bg-card/50 border border-border rounded-lg inline-block">
          <p className="text-sm text-muted-foreground">
            ✓ Instant code-level screening &nbsp;&nbsp; ✓ 0–100 risk score &nbsp;&nbsp; ✓ Branded PDF report
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;