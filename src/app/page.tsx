import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="font-semibold text-xl text-slate-900 dark:text-white">BidOptimizer</span>
          </div>
          <Link
            href="/calculator"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Open Calculator →
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
            Powered by Nobel Prize-winning Auction Theory
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            Bid Smarter,<br />Not Higher
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8">
            Stop guessing on home offers. BidOptimizer uses game theory and behavioral
            economics to calculate your optimal bid—maximizing your chance of winning
            while protecting you from overpaying.
          </p>
          <Link
            href="/calculator"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors shadow-lg shadow-emerald-500/25"
          >
            Calculate Your Optimal Bid →
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            icon="🎯"
            title="Winner's Curse Protection"
            description="Automatically adjusts your bid based on competition level to prevent overpaying—a problem that costs buyers 1.3% annually."
          />
          <FeatureCard
            icon="📊"
            title="Risk-Adjusted Strategy"
            description="Tailors recommendations to your risk tolerance. Conservative, optimal, or aggressive—you choose your comfort level."
          />
          <FeatureCard
            icon="🧠"
            title="Behavioral Insights"
            description="Accounts for loss aversion and emotional factors that cause most buyers to overbid in competitive markets."
          />
        </div>

        {/* How It Works */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Step number={1} title="Property Details" description="Enter the listing price and your estimated value" />
            <Step number={2} title="Market Conditions" description="Days on market, price changes, competition level" />
            <Step number={3} title="Your Preferences" description="Risk tolerance and how much you want this home" />
            <Step number={4} title="Get Your Bid" description="Receive three optimized bid recommendations" />
          </div>
        </div>

        {/* Academic Foundation */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Built on rigorous academic research</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <span>Milgrom & Weber (1982)</span>
            <span>•</span>
            <span>Kőszegi & Rabin (2006)</span>
            <span>•</span>
            <span>2020 Nobel Prize in Economics</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 mt-16">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>BidOptimizer • Game Theory for Home Buyers</p>
          <p className="mt-2">For educational and decision-support purposes only. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300 text-sm">{description}</p>
    </div>
  );
}

// Step Component
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-3">
        {number}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}
