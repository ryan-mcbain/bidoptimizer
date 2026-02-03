import { BidCalculator } from '@/components/BidCalculator';

export const metadata = {
  title: 'Bid Calculator | OfferEdge',
  description: 'Calculate your optimal home bid using game theory and behavioral economics.',
};

/**
 * Calculator Page
 *
 * This page hosts the main bid optimization wizard.
 * Route: /calculator
 */
export default function CalculatorPage() {
  return <BidCalculator />;
}
