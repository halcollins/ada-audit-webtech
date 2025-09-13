const Hero = () => {
  return (
    <section className="bg-gradient-hero py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
          Get Your <span className="text-primary">Free ADA Audit</span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Enter your details and website URL below for a comprehensive accessibility audit. 
          Discover potential ADA compliance issues and see how WebTECH Consulting can help 
          make your website accessible to all users.
        </p>
        <div className="mt-8 p-6 bg-card/50 border border-border rounded-lg inline-block">
          <p className="text-sm text-muted-foreground">
            ✓ Instant WCAG 2.1 analysis &nbsp;&nbsp; ✓ Detailed violation reports &nbsp;&nbsp; ✓ Professional recommendations
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;